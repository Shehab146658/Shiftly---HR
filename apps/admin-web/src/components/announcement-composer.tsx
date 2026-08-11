"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import type { AppLocale } from "@/lib/i18n";

type Option = { id: string; label: string; meta?: string };

export function AnnouncementComposer({ action, locale, branches, teams, employees, roles }: {
  action: (formData: FormData) => Promise<void>;
  locale: AppLocale;
  branches: Option[];
  teams: Option[];
  employees: Option[];
  roles: Option[];
}) {
  const [scope, setScope] = useState<"company" | "branches" | "teams" | "employees" | "roles">("company");
  const ar = locale === "ar";
  const copy = ar ? {
    titleEn: "العنوان بالإنجليزية", titleAr: "العنوان بالعربية", bodyEn: "الرسالة بالإنجليزية", bodyAr: "الرسالة بالعربية", priority: "الأولوية",
    normal: "عادي", important: "مهم", critical: "عاجل", audience: "الجمهور", company: "كل الشركة", branches: "فروع", teams: "فرق", employees: "موظفون", roles: "أدوار",
    companyHint: "سيصل الإعلان إلى كل حساب نشط في الشركة.", selectAudience: "اختر جمهوراً واحداً أو أكثر", pinned: "تثبيت الإعلان", acknowledgement: "طلب تأكيد القراءة",
    expires: "تاريخ الانتهاء (اختياري)", attachments: "مرفقات (حتى 5 صور أو ملفات PDF)", create: "حفظ كمسودة", created: "تم حفظ مسودة الإعلان.", saving: "جارٍ حفظ المسودة…", failed: "تعذر حفظ الإعلان. راجع المحتوى والجمهور.",
  } : {
    titleEn: "English title", titleAr: "Arabic title", bodyEn: "English message", bodyAr: "Arabic message", priority: "Priority",
    normal: "Normal", important: "Important", critical: "Critical", audience: "Audience", company: "Entire company", branches: "Branches", teams: "Teams", employees: "Employees", roles: "Roles",
    companyHint: "Every active company account will receive this announcement.", selectAudience: "Select one or more audience groups", pinned: "Pin this announcement", acknowledgement: "Require read acknowledgement",
    expires: "Expires (optional)", attachments: "Attachments (up to 5 images or PDFs)", create: "Save as draft", created: "Announcement draft saved.", saving: "Saving draft…", failed: "Could not save the announcement. Review its content and audience.",
  };
  const options = scope === "branches" ? branches : scope === "teams" ? teams : scope === "employees" ? employees : scope === "roles" ? roles : [];
  return <ActionForm action={action} className="stack" errorMessage={copy.failed} pendingMessage={copy.saving} resetOnSuccess successMessage={copy.created}>
    <div className="form-grid announcement-form-grid">
      <div className="field"><label>{copy.titleEn}</label><input className="input" name="titleEn" required /></div><div className="field"><label>{copy.titleAr}</label><input className="input" dir="rtl" name="titleAr" /></div>
      <div className="field full"><label>{copy.bodyEn}</label><textarea className="textarea" name="bodyEn" required rows={5} /></div><div className="field full"><label>{copy.bodyAr}</label><textarea className="textarea" dir="rtl" name="bodyAr" rows={5} /></div>
      <div className="field"><label>{copy.priority}</label><select className="select" defaultValue="normal" name="priority"><option value="normal">{copy.normal}</option><option value="important">{copy.important}</option><option value="critical">{copy.critical}</option></select></div>
      <div className="field"><label>{copy.expires}</label><input className="input" name="expiresAt" type="datetime-local" /></div>
      <label className="check-field field"><input name="pinned" type="checkbox" /><span>{copy.pinned}</span></label><label className="check-field field"><input name="acknowledgement" type="checkbox" /><span>{copy.acknowledgement}</span></label>
      <div className="field full"><label>{copy.attachments}</label><input accept="image/jpeg,image/png,image/webp,application/pdf" className="input file-input" multiple name="attachments" type="file" /></div>
    </div>
    <div className="field"><label>{copy.audience}</label><div className="segmented-control announcement-scope-control">
      {(["company", "branches", "teams", "employees", "roles"] as const).map((value) => <label className={scope === value ? "selected" : ""} key={value}><input checked={scope === value} name="scope" onChange={() => setScope(value)} type="radio" value={value} /><span>{copy[value]}</span></label>)}
    </div></div>
    {scope === "company" ? <div className="audience-company-note">{copy.companyHint}</div> : <fieldset className="audience-picker"><legend>{copy.selectAudience}</legend><div className="audience-option-grid">
      {options.map((option) => <label className="audience-option" key={option.id}><input name="scopeIds" type="checkbox" value={option.id} /><span><strong>{option.label}</strong>{option.meta ? <small>{option.meta}</small> : null}</span></label>)}
    </div></fieldset>}
    <button className="button" type="submit">{copy.create}</button>
  </ActionForm>;
}
