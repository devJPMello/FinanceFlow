import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserPayload } from '../common/interfaces/user.interface';
import { ParamIdDto } from '../common/dto/param-id.dto';
import { ImportExtractDto } from './dto/import-extract.dto';
import { BatchTransactionsDto } from './dto/batch-transactions.dto';
import { ConfirmImportDto } from './dto/confirm-import.dto';
import { MergeDuplicateDto } from './dto/merge-duplicate.dto';
import {
  ATTACHMENT_MAX_FILE_BYTES,
  IMPORT_MAX_FILE_BYTES,
} from '../common/constants/upload-limits';

@ApiTags('transactions')
@Controller('transactions')
@UseGuards(ClerkAuthGuard)
@ApiBearerAuth('JWT-auth')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar nova transação financeira' })
  @ApiResponse({ status: 201, description: 'Transação criada com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  create(
    @CurrentUser() user: UserPayload,
    @Body() createTransactionDto: CreateTransactionDto,
  ) {
    return this.transactionsService.create(user.id, createTransactionDto);
  }

  @Post('import/ai')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: IMPORT_MAX_FILE_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Importar transações via IA (CSV, PDF ou imagem) — Gemini extrai movimentos',
  })
  @ApiResponse({ status: 201, description: 'Importação concluída' })
  importAi(
    @CurrentUser() user: UserPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: ImportExtractDto,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Envie um ficheiro CSV, PDF ou imagem');
    }
    return this.transactionsService.importAiExtract(
      user.id,
      file.buffer,
      file.mimetype || '',
      file.originalname || '',
      body,
    );
  }

  @Post('import/ai/preview')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: IMPORT_MAX_FILE_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Pré-visualizar extração IA (CSV, PDF ou imagem) antes de confirmar' })
  previewAi(
    @CurrentUser() user: UserPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: ImportExtractDto,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Envie um ficheiro CSV, PDF ou imagem');
    }
    return this.transactionsService.previewAiExtract(
      user.id,
      file.buffer,
      file.mimetype || '',
      file.originalname || '',
      body,
    );
  }

  @Post('import/confirm')
  @ApiOperation({ summary: 'Gravar lançamentos após revisão do preview' })
  confirmImport(@CurrentUser() user: UserPayload, @Body() body: ConfirmImportDto) {
    return this.transactionsService.confirmImport(user.id, body);
  }

  @Get('duplicates')
  @ApiOperation({ summary: 'Candidatos a duplicata (mesmo dia, valor e memo/descrição)' })
  duplicates(@CurrentUser() user: UserPayload, @Query('days') days?: string) {
    return this.transactionsService.findDuplicateCandidates(
      user.id,
      days ? Math.min(365, Math.max(30, Number(days))) : 120,
    );
  }

  @Post('merge-duplicate')
  @ApiOperation({ summary: 'Fundir duplicata: manter um id e remover o outro (anexos migrados)' })
  mergeDuplicate(@CurrentUser() user: UserPayload, @Body() body: MergeDuplicateDto) {
    return this.transactionsService.mergeDuplicateTransactions(
      user.id,
      body.keepTransactionId,
      body.removeTransactionId,
    );
  }

  @Patch('batch')
  @ApiOperation({ summary: 'Atualizar várias transações (categoria, IR, nota)' })
  batchUpdate(@CurrentUser() user: UserPayload, @Body() body: BatchTransactionsDto) {
    return this.transactionsService.batchUpdateTransactions(user.id, body);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas as transações do usuário' })
  @ApiResponse({ status: 200, description: 'Lista de transações retornada com sucesso' })
  findAll(@CurrentUser() user: UserPayload, @Query() query: TransactionQueryDto) {
    return this.transactionsService.findAll(user.id, query);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Obter saldo atual do usuário' })
  @ApiResponse({ status: 200, description: 'Saldo retornado com sucesso' })
  getBalance(@CurrentUser() user: UserPayload) {
    return this.transactionsService.getBalance(user.id);
  }

  @Post(':id/attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: ATTACHMENT_MAX_FILE_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Anexar recibo/NF ao lançamento (baú fiscal)' })
  addAttachment(
    @CurrentUser() user: UserPayload,
    @Param('id') transactionId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Ficheiro em falta');
    }
    return this.transactionsService.addAttachment(user.id, transactionId, file);
  }

  @Get(':id/attachments')
  @ApiOperation({ summary: 'Listar anexos da transação' })
  listAttachments(
    @CurrentUser() user: UserPayload,
    @Param('id') transactionId: string,
  ) {
    return this.transactionsService.listAttachments(user.id, transactionId);
  }

  @Get(':id/attachments/:attachmentId/download')
  @ApiOperation({ summary: 'Descarregar anexo' })
  async downloadAttachment(
    @CurrentUser() user: UserPayload,
    @Param('id') transactionId: string,
    @Param('attachmentId') attachmentId: string,
    @Query('token') token: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (token) {
      this.transactionsService.validateAttachmentDownloadToken(
        token,
        user.id,
        transactionId,
        attachmentId,
      );
    }
    const { stream, fileName, mimeType } =
      await this.transactionsService.getAttachmentStream(
        user.id,
        transactionId,
        attachmentId,
      );
    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(fileName)}"`,
    );
    return new StreamableFile(stream);
  }

  @Get(':id/attachments/:attachmentId/link')
  @ApiOperation({ summary: 'Gerar link temporário para download de anexo' })
  getAttachmentDownloadLink(
    @CurrentUser() user: UserPayload,
    @Param('id') transactionId: string,
    @Param('attachmentId') attachmentId: string,
    @Query('expiresIn') expiresIn?: string,
  ) {
    const { token, expiresAt } = this.transactionsService.createAttachmentDownloadToken(
      user.id,
      transactionId,
      attachmentId,
      Number(expiresIn || 300),
    );
    return {
      expiresAt,
      url: `/api/transactions/${transactionId}/attachments/${attachmentId}/download?token=${token}`,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar transação por ID' })
  @ApiResponse({ status: 200, description: 'Transação encontrada' })
  @ApiResponse({ status: 404, description: 'Transação não encontrada' })
  findOne(@CurrentUser() user: UserPayload, @Param() param: ParamIdDto) {
    return this.transactionsService.findOne(user.id, param.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar transação' })
  @ApiResponse({ status: 200, description: 'Transação atualizada com sucesso' })
  @ApiResponse({ status: 404, description: 'Transação não encontrada' })
  update(
    @CurrentUser() user: UserPayload,
    @Param() param: ParamIdDto,
    @Body() updateTransactionDto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(user.id, param.id, updateTransactionDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover transação' })
  @ApiResponse({ status: 200, description: 'Transação removida com sucesso' })
  @ApiResponse({ status: 404, description: 'Transação não encontrada' })
  remove(@CurrentUser() user: UserPayload, @Param() param: ParamIdDto) {
    return this.transactionsService.remove(user.id, param.id);
  }
}
