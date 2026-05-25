"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * @param {{
 *   open: boolean;
 *   title: string;
 *   onConfirm: (password: string) => void;
 *   onCancel: () => void;
 * }} props
 */
export function LockDialog({ open, title, onConfirm, onCancel }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!password.trim()) {
      setError("من فضلك أدخل كلمة المرور.");
      return;
    }
    setError("");
    onConfirm(password.trim());
    setPassword("");
  };

  const handleCancel = () => {
    setPassword("");
    setError("");
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" aria-hidden />
            {title}
          </DialogTitle>
          <DialogDescription>
            هذه الميزة محمية بكلمة مرور. من فضلك أدخل كلمة المرور للمتابعة.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="lock-password">كلمة المرور</Label>
          <Input
            id="lock-password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            autoFocus
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            إلغاء
          </Button>
          <Button type="button" onClick={handleSubmit}>
            تأكيد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
