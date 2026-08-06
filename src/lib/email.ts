import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.EMAIL_FROM ?? "Wax <noreply@wax.app>";

function appUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "") ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  // If the value already has a scheme, use it as-is. Otherwise prepend https.
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function emailHtml(heading: string, body: string, cta: { href: string; label: string }): string {
  const expiry = cta.href.includes("reset") ? "1 hour" : "24 hours";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${heading}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f4f5" style="background-color:#f4f4f5;padding:40px 20px">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
      <tr><td align="center" style="padding-bottom:20px">
        <span style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7c3aed">WAX</span>
      </td></tr>
      <tr><td bgcolor="#ffffff" style="background-color:#ffffff;border-radius:8px;padding:36px 40px;border:1px solid #e4e4e7">
        <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#18181b;line-height:1.3">${heading}</h1>
        <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#52525b">${body}</p>
        <table cellpadding="0" cellspacing="0"><tr><td bgcolor="#7c3aed" style="background-color:#7c3aed;border-radius:6px">
          <a href="${cta.href}" style="display:inline-block;background-color:#7c3aed;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:6px">${cta.label}</a>
        </td></tr></table>
        <p style="margin:28px 0 0;font-size:12px;color:#a1a1aa">If you didn't request this, you can safely ignore this email. This link expires in ${expiry}.</p>
      </td></tr>
      <tr><td align="center" style="padding-top:20px">
        <p style="margin:0;font-size:12px;color:#a1a1aa">Wax &mdash; your music journal</p>
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
    text: `Confirm your email\n\nThanks for joining Wax. Click the link below to verify your email address:\n\n${url}\n\nThis link expires in 24 hours. If you didn't request this, you can safely ignore this email.`,
  });
  if (error) console.error("Failed to send verification email:", error);
}

export async function sendNewUserNotification(username: string, email: string): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;
  const { error } = await resend.emails.send({
    from: FROM,
    to: adminEmail,
    subject: `New Wax sign-up: @${username}`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:32px;background-color:#f4f4f5;font-family:sans-serif;color:#18181b">
  <p style="margin:0 0 8px;font-size:15px;color:#52525b">New account created on Wax:</p>
  <p style="margin:0 0 4px;font-size:18px;font-weight:700;color:#18181b">@${username}</p>
  <p style="margin:0;font-size:13px;color:#71717a">${email}</p>
</body></html>`,
    text: `New Wax sign-up\n\n@${username}\n${email}`,
  });
  if (error) console.error("Failed to send new user notification:", error);
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
    text: `Reset your password\n\nWe received a request to reset your Wax password. Click the link below to choose a new one:\n\n${url}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.`,
  });
  if (error) console.error("Failed to send password reset email:", error);
}
