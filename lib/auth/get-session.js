import { cookies } from "next/headers";

import { decodeSessionToken, SESSION_COOKIE } from "@/lib/auth/session";

/**
 * @returns {Promise<{ email: string; name: string; role: string; branch: string } | null>}
 */
export async function getSessionUser() {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;
  return decodeSessionToken(value);
}
