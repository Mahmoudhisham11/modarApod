import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "هذه العملية تتم من جهاز العميل." }, { status: 400 });
}
