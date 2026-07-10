import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/forms/login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="panel w-full max-w-md rounded-lg p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay">Personal Command Center</p>
        <h1 className="mt-2 text-2xl font-black text-ink">Masuk</h1>
        <p className="mt-2 text-sm text-ink/60">Gunakan akun seed demo atau user yang Anda buat di database.</p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
