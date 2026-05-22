import crypto from "node:crypto";
import { NextResponse } from "next/server";

const CLOUD_NAME = "drtdv4iyr";
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

/**
 * Extract public_id from a Cloudinary secure_url.
 * Input: https://res.cloudinary.com/<cloud>/image/upload/v<version>/<public_id>.<ext>
 * Output: <public_id>  (includes folder path if any)
 */
function extractPublicId(imageUrl) {
  try {
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split("/");
    const uploadIndex = pathParts.indexOf("upload");
    if (uploadIndex === -1 || uploadIndex + 2 >= pathParts.length) return null;
    const versionAndAfter = pathParts.slice(uploadIndex + 2);
    const joined = versionAndAfter.join("/");
    const dotIndex = joined.lastIndexOf(".");
    return dotIndex === -1 ? joined : joined.slice(0, dotIndex);
  } catch {
    return null;
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { imageUrl } = body;
  if (!imageUrl || typeof imageUrl !== "string") {
    return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
  }

  const publicId = extractPublicId(imageUrl);
  if (!publicId) {
    return NextResponse.json({ error: "Invalid Cloudinary URL" }, { status: 400 });
  }

  if (!CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return NextResponse.json({ error: "Cloudinary credentials not configured" }, { status: 500 });
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = `public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
    const signature = crypto.createHash("sha1").update(toSign).digest("hex");

    const formData = new URLSearchParams();
    formData.append("public_id", publicId);
    formData.append("api_key", CLOUDINARY_API_KEY);
    formData.append("timestamp", String(timestamp));
    formData.append("signature", signature);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      },
    );

    const json = await res.json();

    if (json.result === "ok" || json.result === "not found") {
      return NextResponse.json({ ok: true });
    }

    console.error("Cloudinary delete error response:", json);
    return NextResponse.json({ error: json.error?.message ?? "Delete failed" }, { status: 500 });
  } catch (e) {
    console.error("Cloudinary delete exception:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
