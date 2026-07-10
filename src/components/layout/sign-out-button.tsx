"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="button-secondary w-full"
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      Keluar
    </button>
  );
}
