import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let transporter: Transporter | null = null;

export function isEmailEnabled(): boolean {
  return env.smtpEnabled;
}

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? '' } : undefined,
    });
  }
  return transporter;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Envia por SMTP. Lanza si falla para que la alerta quede marcada como FAILED. */
export async function sendMail(message: MailMessage): Promise<void> {
  await getTransporter().sendMail({
    from: env.SMTP_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
}

/** Canal de respaldo: log estructurado visible en la consola de Vercel. */
export function logAlertToConsole(message: MailMessage): void {
  logger.info(
    { channel: 'CONSOLE', to: message.to, subject: message.subject, body: message.text },
    'Alerta SLA (correo deshabilitado)',
  );
}
