import { NextResponse } from "next/server";

import { sendToAllTokens } from "@/lib/notifications/send-notification";

export async function POST(request) {
  try {
    const { title, body } = await request.json();

    if (!title || !body) {
      return NextResponse.json({ success: false, error: "title and body are required." }, { status: 400 });
    }

    const result = await sendToAllTokens({ title, body });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
