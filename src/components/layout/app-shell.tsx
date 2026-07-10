import { Navigation } from "@/components/layout/navigation";
import { SignOutButton } from "@/components/layout/sign-out-button";

export function AppShell({
  userName,
  children
}: {
  userName?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="border-b border-line bg-paper/90 px-4 py-4 backdrop-blur lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
        <div className="flex items-center justify-between gap-4 lg:block">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay">Personal</p>
            <h1 className="mt-1 text-xl font-black text-ink">Command Center</h1>
          </div>
          <div className="hidden rounded-md border border-line bg-white px-3 py-2 text-xs text-ink/70 lg:block">
            Masuk sebagai <span className="font-semibold text-ink">{userName ?? "User"}</span>
          </div>
        </div>
        <div className="mt-5">
          <Navigation />
        </div>
        <div className="mt-5 hidden lg:block">
          <SignOutButton />
        </div>
      </aside>
      <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
