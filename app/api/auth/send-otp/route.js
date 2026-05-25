import { NextResponse } from "next/server";

import { sendOtpEmail } from "@/lib/auth/email";

export async function POST(request) {
  try {
    const { email, otp } = await request.json();
    if (!email || !otp) {
      return NextResponse.json({ error: "البريد الإلكتروني ورمز التحقق مطلوبان." }, { status: 400 });
    }

    const result = await sendOtpEmail(email.trim().toLowerCase(), otp);

    if (!result.ok) {
      return NextResponse.json({
        success: false,
        noSmtp: true,
        otp,
        error: result.error || "تعذر إرسال الإيميل.",
      }, { status: 200 });
    }

    return NextResponse.json({ success: true, message: "تم إرسال رمز التحقق إلى بريدك الإلكتروني." });
  } catch (err) {
    console.error("send-otp error:", err);
    return NextResponse.json({ error: "حدث خطأ أثناء إرسال الرمز." }, { status: 500 });
  }
}
