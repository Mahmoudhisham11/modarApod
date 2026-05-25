import nodemailer from "nodemailer";

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  return null;
}

/**
 * @param {string} to
 * @param {string} otp
 * @returns {Promise<{ ok: boolean; error?: string }>}
 */
export async function sendOtpEmail(to, otp) {
  const transporter = getTransporter();
  if (!transporter) {
    return { ok: false, error: "SMTP غير مضبوط في إعدادات الخادم." };
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"مداد" <${process.env.SMTP_USER || "noreply@madar.app"}>`,
      to,
      subject: "رمز التحقق - استعادة كلمة المرور",
      text: `رمز التحقق الخاص بك هو: ${otp}\n\nهذا الرمز صالح لمدة 10 دقائق.`,
      html: `
        <div dir="rtl" style="font-family:sans-serif;padding:24px">
          <h2 style="color:#1a1a2e">استعادة كلمة المرور</h2>
          <p>رمز التحقق الخاص بك هو:</p>
          <div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:16px;background:#f5f5f5;border-radius:8px;margin:16px 0">
            ${otp}
          </div>
          <p style="color:#666">هذا الرمز صالح لمدة 10 دقائق.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
          <p style="color:#999;font-size:12px">إذا لم تطلب استعادة كلمة المرور، يمكنك تجاهل هذه الرسالة.</p>
        </div>
      `,
    });
    return { ok: true };
  } catch (err) {
    console.error("sendOtpEmail error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "فشل إرسال الإيميل." };
  }
}
