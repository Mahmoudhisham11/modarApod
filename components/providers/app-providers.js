"use client";

import { Toaster } from "@/components/ui/sonner";

export function AppProviders({ children }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
