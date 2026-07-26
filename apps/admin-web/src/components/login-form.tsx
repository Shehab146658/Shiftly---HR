"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AppLocale } from "@/lib/i18n";

export function LoginForm({ locale, labels }: { locale: AppLocale; labels: Record<string, string> }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    try {
      const supabase = createSupabaseBrowserClient();
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      router.replace(`/${locale}/dashboard`);
      router.refresh();
    } catch {
      setError(labels.invalidLogin);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="field">
        <label htmlFor="email">{labels.email}</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="password">{labels.password}</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error ? <div className="error" role="alert">{error}</div> : null}
      <button className="button" type="submit" disabled={loading}>{loading ? "…" : labels.signIn}</button>
    </form>
  );
}
