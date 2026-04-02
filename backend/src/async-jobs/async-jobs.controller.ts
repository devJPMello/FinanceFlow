import { BadRequestException, Body, Controller, Get, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserPayload } from '../common/interfaces/user.interface';
import { AsyncJobsService } from './async-jobs.service';
import { ImportExtractDto } from '../transactions/dto/import-extract.dto';
import { ASYNC_JOB_PDF_MAX_BYTES } from '../common/constants/upload-limits';

@ApiTags('async-jobs')
@Controller('async-jobs')
@UseGuards(ClerkAuthGuard)
@ApiBearerAuth('JWT-auth')
export class AsyncJobsController {
  constructor(private readonly asyncJobs: AsyncJobsService) {}

  @Post()
  @ApiOperation({ summary: 'Enfileirar trabalho assíncrono pesado' })
  enqueue(
    @CurrentUser() user: UserPayload,
    @Body() body: { type: 'import_pdf' | 'ocr_attachment' | 'weekly_summary'; payload: Record<string, unknown> },
  ) {
    return this.asyncJobs.enqueue(user.id, body.type, body.payload || {});
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar status/progresso de job assíncrono' })
  getOne(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.asyncJobs.getJob(user.id, id);
  }

  @Post('import/pdf')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: ASYNC_JOB_PDF_MAX_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Enfileirar importação de extrato PDF' })
  enqueuePdfImport(
    @CurrentUser() user: UserPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: ImportExtractDto,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('Ficheiro em falta');
    return this.asyncJobs.enqueue(user.id, 'import_pdf', {
      fileBase64: file.buffer.toString('base64'),
      mimeType: file.mimetype || '',
      originalName: file.originalname || '',
      importDto: body || {},
    });
  }

  @Post('ocr')
  @ApiOperation({ summary: 'Enfileirar OCR de anexo com progresso' })
  enqueueOcr(
    @CurrentUser() user: UserPayload,
    @Body() body: { attachmentId: string },
  ) {
    if (!body?.attachmentId) throw new BadRequestException('attachmentId em falta');
    return this.asyncJobs.enqueue(user.id, 'ocr_attachment', {
      attachmentId: body.attachmentId,
    });
  }

  @Post('weekly-summary')
  @ApiOperation({ summary: 'Enfileirar resumo financeiro semanal com IA' })
  enqueueWeeklySummary(
    @CurrentUser() user: UserPayload,
    @Body() body: { weekStart?: string },
  ) {
    return this.asyncJobs.enqueue(user.id, 'weekly_summary', {
      weekStart: body?.weekStart,
    });
  }
}
