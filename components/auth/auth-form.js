"use client";

import { Suspense } from "react";

import { AuthFormInner } from "./auth-form-inner";

function AuthFormFallback() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">جاري التحميل…</p>
    </div>
  );
}

export function AuthForm() {
  return (
    <Suspense fallback={<AuthFormFallback />}>
      <AuthFormInner />
    </Suspense>
  );
}
