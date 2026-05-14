import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { getSessionUser } from "@/lib/auth/get-session";

export const metadata = {
  title: "تسجيل الدخول",
};

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/");

  return <AuthForm />;
}
