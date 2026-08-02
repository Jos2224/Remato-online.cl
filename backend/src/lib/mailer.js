import nodemailer from 'nodemailer';
import { config } from '../config.js';

// Mail is optional infrastructure.
//
// No SMTP server is configured for this deployment, so the whole verification flow is
// inert by default: accounts are created already verified and nothing tries to send.
// The moment SMTP_URL is set, verification turns on for new accounts with no code
// change. That keeps the feature real without inventing credentials that do not exist.
let transport = null;

if (config.smtpUrl) {
  transport = nodemailer.createTransport(config.smtpUrl);
}

export const mailEnabled = () => transport !== null;

export async function sendMail({ to, subject, text, html }) {
  if (!transport) return false;
  try {
    await transport.sendMail({ from: config.mailFrom, to, subject, text, html });
    return true;
  } catch (error) {
    // A mail failure must never take down a request that already changed the database.
    console.error('[mail] could not send message', error?.code ?? '', error?.message ?? error);
    return false;
  }
}

export function verificationEmail(email, token) {
  const link = `${config.appUrl.replace(/\/$/, '')}/verificar?token=${encodeURIComponent(token)}`;
  return {
    to: email,
    subject: 'Confirma tu cuenta en RematoOnline',
    text: [
      'Bienvenido a RematoOnline.',
      '',
      'Confirma tu correo para poder pujar y publicar:',
      link,
      '',
      'Si no creaste esta cuenta, puedes ignorar este mensaje.',
    ].join('\n'),
    html:
      `<p>Bienvenido a RematoOnline.</p>` +
      `<p>Confirma tu correo para poder pujar y publicar:</p>` +
      `<p><a href="${link}">Confirmar mi cuenta</a></p>` +
      `<p>Si no creaste esta cuenta, puedes ignorar este mensaje.</p>`,
  };
}
