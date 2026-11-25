import {
  BadRequestException, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Post, Res, StreamableFile, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { promises as fs } from 'fs';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.module';
import { filePath, removeFiles, saveFile } from './storage';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PER_TRANSACTION = 5;
const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);

@Injectable()
export class AttachmentsService {
  constructor(private prisma: PrismaService) {}

  async add(userId: string, transactionId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Arquivo obrigatório');
    if (!ALLOWED.has(file.mimetype)) throw new BadRequestException('Envie PDF, PNG, JPG ou WEBP');
    if (!(await this.prisma.transaction.findFirst({ where: { id: transactionId, userId }, select: { id: true } }))) throw new NotFoundException();
    if ((await this.prisma.attachment.count({ where: { transactionId } })) >= MAX_PER_TRANSACTION) {
      throw new BadRequestException(`Máximo de ${MAX_PER_TRANSACTION} anexos por transação`);
    }
    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 120);
    const att = await this.prisma.attachment.create({
      data: { userId, transactionId, fileName, mime: file.mimetype, size: file.size },
      select: { id: true, fileName: true, mime: true, size: true },
    });
    await saveFile(userId, att.id, file.buffer);
    return att;
  }

  async get(userId: string, id: string) {
    const att = await this.prisma.attachment.findFirst({ where: { id, userId } });
    if (!att) throw new NotFoundException();
    return { att, data: await fs.readFile(filePath(userId, id)).catch(() => { throw new NotFoundException(); }) };
  }

  async remove(userId: string, id: string) {
    const r = await this.prisma.attachment.deleteMany({ where: { id, userId } });
    if (!r.count) throw new NotFoundException();
    await removeFiles(userId, [id]);
  }
}

@ApiTags('attachments')
@ApiBearerAuth()
@Controller()
export class AttachmentsController {
  constructor(private svc: AttachmentsService) {}

  @Post('transactions/:id/attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }))
  add(@CurrentUser() u: string, @Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.svc.add(u, id, file);
  }

  @Get('attachments/:id/download')
  async download(@CurrentUser() u: string, @Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const { att, data } = await this.svc.get(u, id);
    res.set({
      'Content-Type': att.mime,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(att.fileName)}`,
    });
    return new StreamableFile(data);
  }

  @Delete('attachments/:id') remove(@CurrentUser() u: string, @Param('id') id: string) { return this.svc.remove(u, id); }
}

@Module({ controllers: [AttachmentsController], providers: [AttachmentsService] })
export class AttachmentsModule {}
