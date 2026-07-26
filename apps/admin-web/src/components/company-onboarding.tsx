import type { AppLocale } from "@/lib/i18n";
import { createTenant } from "@/app/[locale]/(protected)/actions";

export function CompanyOnboarding({ locale, labels }: { locale: AppLocale; labels: Record<string, string> }) {
  const action = createTenant.bind(null, locale);
  return (
    <section className="card stack">
      <div><h2>{labels.createCompany}</h2><p className="muted">{labels.noCompany}</p></div>
      <form action={action} className="form-grid">
        <div className="field"><label>{labels.nameEnglish}</label><input className="input" name="nameEn" required /></div>
        <div className="field"><label>{labels.nameArabic}</label><input className="input" name="nameAr" dir="rtl" /></div>
        <div className="field"><label>{labels.slug}</label><input className="input" name="slug" placeholder="my-company" pattern="[a-z0-9-]+" required /></div>
        <div className="field"><label>{labels.timezone}</label><input className="input" name="timezone" defaultValue="Africa/Cairo" required /></div>
        <div className="full"><button className="button">{labels.create}</button></div>
      </form>
    </section>
  );
}
