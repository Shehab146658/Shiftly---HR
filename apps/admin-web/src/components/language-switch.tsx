import Link from "next/link";
import type { AppLocale } from "@/lib/i18n";

export function LanguageSwitch({ locale, path = "dashboard" }: { locale: AppLocale; path?: string }) {
  return (
    <div className="language-switch" aria-label="Language">
      <Link href={`/en/${path}`} aria-current={locale === "en" ? "page" : undefined}>English</Link>
      <Link href={`/ar/${path}`} aria-current={locale === "ar" ? "page" : undefined}>العربية</Link>
    </div>
  );
}
