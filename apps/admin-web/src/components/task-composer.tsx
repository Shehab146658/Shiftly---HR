"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import type { AppLocale } from "@/lib/i18n";

type Option = { id: string; label: string; meta?: string };

export function TaskComposer({ action, locale, employees, teams, branches, defaults }: {
  action: (formData: FormData) => Promise<void>;
  locale: AppLocale;
  employees: Option[];
  teams: Option[];
  branches: Option[];
  defaults: { startAt: string; dueAt: string };
}) {
  const [scope, setScope] = useState<"employees" | "team" | "branch" | "company">("employees");
  const [recurrence, setRecurrence] = useState<"none" | "daily" | "weekly" | "monthly">("none");
  const ar = locale === "ar";
  const copy = ar ? {
    titleEn: "العنوان بالإنجليزية", titleAr: "العنوان بالعربية", descriptionEn: "التعليمات بالإنجليزية", descriptionAr: "التعليمات بالعربية",
    priority: "الأولوية", normal: "عادية", low: "منخفضة", high: "مرتفعة", urgent: "عاجلة", start: "تبدأ", due: "الموعد النهائي",
    audience: "الإسناد إلى", employees: "موظفون محددون", team: "فريق", branch: "فرع", company: "كل الشركة", selectPeople: "اختر شخصاً أو أكثر",
    selectTeams: "اختر فريقاً أو أكثر", selectBranches: "اختر فرعاً أو أكثر", everyone: "سيتم إسناد المهمة إلى جميع الموظفين النشطين.",
    evidence: "طلب صورة أو ملف كدليل", recurrence: "التكرار", none: "مرة واحدة", daily: "يومياً", weekly: "أسبوعياً", monthly: "شهرياً",
    every: "كل", until: "حتى", create: "إنشاء وإسناد المهمة", created: "تم إنشاء المهمة وإسنادها.", saving: "جارٍ إسناد المهمة…", failed: "تعذر إنشاء المهمة. راجع الحقول والنطاق.",
  } : {
    titleEn: "English title", titleAr: "Arabic title", descriptionEn: "English instructions", descriptionAr: "Arabic instructions",
    priority: "Priority", normal: "Normal", low: "Low", high: "High", urgent: "Urgent", start: "Starts", due: "Due",
    audience: "Assign to", employees: "Selected employees", team: "Team", branch: "Branch", company: "Entire company", selectPeople: "Select one or more people",
    selectTeams: "Select one or more teams", selectBranches: "Select one or more branches", everyone: "Every active employee will receive this task.",
    evidence: "Require photo or file evidence", recurrence: "Recurrence", none: "One time", daily: "Daily", weekly: "Weekly", monthly: "Monthly",
    every: "Every", until: "Until", create: "Create and assign task", created: "Task created and assigned.", saving: "Assigning task…", failed: "Could not create the task. Review its fields and audience.",
  };
  const options = scope === "employees" ? employees : scope === "team" ? teams : scope === "branch" ? branches : [];
  const selectionHint = scope === "employees" ? copy.selectPeople : scope === "team" ? copy.selectTeams : copy.selectBranches;

  return <ActionForm action={action} className="stack" errorMessage={copy.failed} pendingMessage={copy.saving} resetOnSuccess successMessage={copy.created}>
    <div className="form-grid task-form-grid">
      <div className="field"><label>{copy.titleEn}</label><input className="input" name="titleEn" required /></div>
      <div className="field"><label>{copy.titleAr}</label><input className="input" dir="rtl" name="titleAr" /></div>
      <div className="field full"><label>{copy.descriptionEn}</label><textarea className="textarea" name="descriptionEn" required rows={3} /></div>
      <div className="field full"><label>{copy.descriptionAr}</label><textarea className="textarea" dir="rtl" name="descriptionAr" rows={3} /></div>
      <div className="field"><label>{copy.priority}</label><select className="select" defaultValue="normal" name="priority"><option value="low">{copy.low}</option><option value="normal">{copy.normal}</option><option value="high">{copy.high}</option><option value="urgent">{copy.urgent}</option></select></div>
      <div className="field"><label>{copy.start}</label><input className="input" defaultValue={defaults.startAt} name="startAt" required type="datetime-local" /></div>
      <div className="field"><label>{copy.due}</label><input className="input" defaultValue={defaults.dueAt} name="dueAt" required type="datetime-local" /></div>
      <label className="check-field field"><input name="requireEvidence" type="checkbox" /><span>{copy.evidence}</span></label>
    </div>
    <div className="field"><label>{copy.audience}</label><div className="segmented-control task-scope-control">
      {(["employees", "team", "branch", "company"] as const).map((value) => <label className={scope === value ? "selected" : ""} key={value}><input checked={scope === value} name="scope" onChange={() => setScope(value)} type="radio" value={value} /><span>{copy[value]}</span></label>)}
    </div></div>
    {scope === "company" ? <div className="audience-company-note">{copy.everyone}</div> : <fieldset className="audience-picker"><legend>{selectionHint}</legend><div className="audience-option-grid">
      {options.map((option) => <label className="audience-option" key={option.id}><input name="scopeIds" type="checkbox" value={option.id} /><span><strong>{option.label}</strong>{option.meta ? <small>{option.meta}</small> : null}</span></label>)}
    </div></fieldset>}
    <div className="form-grid task-form-grid">
      <div className="field"><label>{copy.recurrence}</label><select className="select" name="recurrence" onChange={(event) => setRecurrence(event.target.value as typeof recurrence)} value={recurrence}><option value="none">{copy.none}</option><option value="daily">{copy.daily}</option><option value="weekly">{copy.weekly}</option><option value="monthly">{copy.monthly}</option></select></div>
      {recurrence !== "none" ? <><div className="field"><label>{copy.every}</label><input className="input" defaultValue="1" min="1" name="recurrenceInterval" required type="number" /></div><div className="field"><label>{copy.until}</label><input className="input" name="recurrenceEndDate" required type="date" /></div></> : <input name="recurrenceInterval" type="hidden" value="1" />}
    </div>
    <button className="button" type="submit">{copy.create}</button>
  </ActionForm>;
}
