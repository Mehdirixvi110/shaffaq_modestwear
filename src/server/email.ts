import nodemailer from "nodemailer";
import { ApiError } from "./http";

// Transactional email via SMTP (defaults to Gmail). Password recovery is the
// only sender today. Configure SMTP_USER + SMTP_PASS (a Google App Password for
// a Gmail account) in the server environment to activate it; host/port default
// to Gmail's SSL endpoint. When unconfigured, emailConfigured() returns false
// and callers degrade gracefully instead of pretending a message was sent.
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || (SMTP_USER ? `SHAFFAQ <${SMTP_USER}>` : "");

export function emailConfigured(): boolean {
  return Boolean(SMTP_USER && SMTP_PASS);
}

export async function sendEmail(options: { to: string; subject: string; text: string; html?: string }): Promise<void> {
  if (!emailConfigured()) {
    throw new ApiError(503, "EMAIL_NOT_CONFIGURED", "Email delivery is not configured on the server.");
  }
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  await transporter.sendMail({ from: SMTP_FROM, to: options.to, subject: options.subject, text: options.text, html: options.html });
}
