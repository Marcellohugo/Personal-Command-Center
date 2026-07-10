"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { LogIn } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError("");

    startTransition(async () => {
      const result = await signIn("credentials", {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        redirect: false
      });

      if (result?.error) {
        setError("Email atau password tidak valid.");
        return;
      }

      router.push("/");
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <label className="label" htmlFor="email">
          Email
        </label>
        <input className="field" id="email" name="email" type="email" defaultValue="demo@example.com" required />
      </div>
      <div className="grid gap-2">
        <label className="label" htmlFor="password">
          Password
        </label>
        <input className="field" id="password" name="password" type="password" defaultValue="password123" required />
      </div>
      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <button className="button-primary" type="submit" disabled={isPending}>
        <LogIn className="h-4 w-4" aria-hidden="true" />
        {isPending ? "Memproses..." : "Masuk"}
      </button>
    </form>
  );
}
