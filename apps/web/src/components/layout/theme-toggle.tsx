"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  if (!mounted) {
    return (
      <button type="button" className={compact ? "button-secondary px-3" : "button-secondary w-full"} aria-label="Ganti tema" title="Ganti tema" disabled>
        <Sun className="h-4 w-4" aria-hidden="true" />
        <span className={compact ? "sr-only" : undefined}>Tema</span>
      </button>
    );
  }

  const label = dark ? "Tema terang" : "Tema gelap";
  return (
    <button type="button" className={compact ? "button-secondary px-3" : "button-secondary w-full"} onClick={toggle} aria-label={label} title={label}>
      {dark ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
      <span className={compact ? "sr-only" : undefined}>{label}</span>
    </button>
  );
}
