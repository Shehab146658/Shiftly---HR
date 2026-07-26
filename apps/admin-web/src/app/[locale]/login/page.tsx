import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { LanguageSwitch } from "@/components/language-switch";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDictionary, isLocale } from "@/lib/i18n";

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : "en";
  const dictionary = getDictionary(locale);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect(`/${locale}/dashboard`);

  return (
    <main className="auth-shell">
      <section className="auth-card stack">
        <div className="toolbar" style={{ justifyContent: "space-between" }}>
          <div className="brand">{dictionary.product}</div>
          <LanguageSwitch locale={locale} path="login" />
        </div>
        <div>
          <h1>{dictionary.signIn}</h1>
          <p className="muted">{dictionary.loginHint}</p>
        </div>
        <LoginForm locale={locale} labels={dictionary} />
      </section>
    </main>
  );
}
