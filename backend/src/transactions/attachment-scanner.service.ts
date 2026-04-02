import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AttachmentScannerService {
  constructor(private readonly config: ConfigService) {}

  async scanOrThrow(file: { originalname?: string; mimetype?: string; buffer: Buffer }) {
    const enabled = String(this.config.get('ATTACHMENT_SCAN_ENABLED') || '').toLowerCase() === 'true';
    if (!enabled) return;

    // Hook simples para expansão futura (ClamAV, API externa etc).
    // Por enquanto só bloqueia arquivos com assinaturas textuais suspeitas evidentes.
    const sample = file.buffer.subarray(0, Math.min(file.buffer.length, 4096)).toString('utf8').toLowerCase();
    const suspicious = ['<script', 'powershell', 'cmd.exe', 'javascript:'];
    if (suspicious.some((token) => sample.includes(token))) {
      throw new Error(`Arquivo bloqueado pela política de segurança (${file.originalname || 'anexo'})`);
    }
  }
}
