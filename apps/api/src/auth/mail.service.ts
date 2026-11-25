import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/**
 * Envia e-mails via SMTP (SMTP_HOST/PORT/USER/PASS, MAIL_FROM).
 * Sem SMTP configurado (desenvolvimento), apenas registra o conteúdo no log do servidor.
 */
@Injectable()
export class MailService {
  private log = new Logger('Mail');
  private transport = process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      })
    : null;

  async send(to: string, subject: string, text: string, html: string) {
    if (!this.transport) {
      this.log.warn(`SMTP não configurado — e-mail para ${to}\nAssunto: ${subject}\n${text}`);
      return;
    }
    await this.transport.sendMail({ from: process.env.MAIL_FROM ?? 'FinanceFlow <no-reply@financeflow.local>', to, subject, text, html });
  }
}
