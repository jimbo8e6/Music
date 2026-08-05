import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.EMAIL_FROM ?? "Wax <noreply@wax.app>";

function appUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function emailHtml(heading: string, body: string, cta: { href: string; label: string }): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f11;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#c8c8d0">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#1a1a1f;border-radius:12px;padding:36px;border:1px solid #2a2a30">
        <tr><td>
          <p style="margin:0 0 4px;font-size:13px;color:#6b6b75;letter-spacing:.05em;text-transform:uppercase;font-weight:600">Wax</p>
          <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#f0f0f3">${heading}</h1>
          <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#9898a5">${body}</p>
          <a href="${cta.href}" style="display:inline-block;background:#a78bfa;color:#0f0f11;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px">${cta.label}</a>
          <p style="margin:28px 0 0;font-size:12px;color:#4a4a55">If you didn't request this, you can safely ignore this email. This link expires in ${cta.href.includes("reset") ? "1 hour" : "24 hours"}.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const url = `${appUrl()}/verify-email/${token}`;
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: "Verify your Wax email address",
    html: emailHtml(
      "Confirm your email",
      "Thanks for joining Wax. Click the button below to verify your email address and complete your account setup.",
      { href: url, label: "Verify email address" },
    ),
  });
  if (error) console.error("Failed to send verification email:", error);
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const url = `${appUrl()}/reset-password/${token}`;
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: "Reset your Wax password",
    html: emailHtml(
      "Reset your password",
      "We received a request to reset your Wax password. Click the button below to choose a new one.",
      { href: url, label: "Reset password" },
    ),
  });
  if (error) console.error("Failed to send password reset email:", error);
}
