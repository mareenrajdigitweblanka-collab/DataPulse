import nodemailer from "nodemailer";
import { env } from "../env.js";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: "Your DataPulse verification code",
    text: `Your verification code is: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #111;">Verify your email</h2>
        <p style="color: #444;">Enter the code below to complete your registration:</p>
        <div style="font-size: 36px; font-weight: bold; letter-spacing: 0.5em; text-align: center; padding: 24px; background: #f4f4f5; border-radius: 12px; margin: 24px 0;">
          ${otp}
        </div>
        <p style="color: #888; font-size: 13px;">This code expires in 10 minutes. Do not share it with anyone.</p>
      </div>
    `,
  });
}
