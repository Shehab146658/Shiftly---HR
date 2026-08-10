import { notFound } from "next/navigation";
import { direction, isLocale } from "@/lib/i18n";

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return <div lang={locale} dir={direction(locale)} style={{ minHeight: "100vh" }}>{children}</div>;
}
