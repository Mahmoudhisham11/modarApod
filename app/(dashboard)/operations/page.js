import { OperationsPageClient } from "@/components/operations/operations-page-client";
import { getSessionUser } from "@/lib/auth/get-session";

export default async function OperationsPage() {
  const user = await getSessionUser();
  const shop = user?.branch ?? "";
  const userEmail = user?.email ?? "";
  const userName = (user?.name ?? "").trim() || userEmail;

  return <OperationsPageClient shop={shop} userEmail={userEmail} userName={userName} />;
}
