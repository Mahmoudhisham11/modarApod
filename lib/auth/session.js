/**
 * ترميز جلسة (Base64URL لـ JSON) للعرض في الواجهة والـ middleware.
 * يُضبط من الخادم بعد التحقق من رمز Firebase.
 */

export const SESSION_COOKIE = "madar_session";

function utf8ToBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToUtf8(b64url) {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/**
 * @param {{ email: string; name: string; role?: string; branch?: string }} payload
 */
export function encodeSessionToken(payload) {
  return utf8ToBase64Url(
    JSON.stringify({
      email: payload.email,
      name: payload.name,
      role: payload.role || "user",
      branch: typeof payload.branch === "string" ? payload.branch : "",
    }),
  );
}

/**
 * @param {string | undefined} value
 * @returns {{ email: string; name: string; role: string; branch: string } | null}
 */
export function decodeSessionToken(value) {
  if (!value || typeof value !== "string") return null;
  try {
    const json = base64UrlToUtf8(value);
    const o = JSON.parse(json);
    if (!o || typeof o.email !== "string" || typeof o.name !== "string") return null;
    return {
      email: o.email,
      name: o.name,
      role: typeof o.role === "string" ? o.role : "user",
      branch: typeof o.branch === "string" ? o.branch : "",
    };
  } catch {
    return null;
  }
}

/**
 * يقرأ قيمة كوكي الجلسة من طلب Fetch القياسي (مستخدم في `middleware.js`).
 * @param {Request} request
 * @returns {string | undefined}
 */
export function getSessionTokenFromRequest(request) {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  const prefix = `${SESSION_COOKIE}=`;
  const parts = header.split(";");
  for (const part of parts) {
    const p = part.trim();
    if (p.startsWith(prefix)) {
      try {
        return decodeURIComponent(p.slice(prefix.length));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}
