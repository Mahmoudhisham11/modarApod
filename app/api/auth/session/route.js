import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { encodeSessionToken, SESSION_COOKIE } from "@/lib/auth/session";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const branch = typeof body.branch === "string" ? body.branch.trim() : "";
  const role = typeof body.role === "string" && body.role.trim() ? body.role.trim() : "cashier";
  const remember = Boolean(body.remember);

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "بريد إلكتروني غير صالح" }, { status: 400 });
  }
  if (name.length < 1) {
    return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });
  }

  const user = {
    email,
    name,
    role,
    branch,
  };
  const token = encodeSessionToken(user);
  const maxAge = remember ? 60 * 60 * 24 * 14 : 60 * 60 * 8;

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge,
    secure: process.env.NODE_ENV === "production",
  });

  return NextResponse.json({ ok: true, user });
}
