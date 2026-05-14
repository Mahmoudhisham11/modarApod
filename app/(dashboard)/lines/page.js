import { LinesPageClient } from "@/components/lines/lines-page-client";
import { getSessionUser } from "@/lib/auth/get-session";

export default async function LinesPage() {
  const user = await getSessionUser();
  const shop = user?.branch ?? "";
  const userEmail = user?.email ?? "";

  return <LinesPageClient shop={shop} userEmail={userEmail} />;
}
