import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { CreateDialog } from "@/components/create-dialog";
import { getTenantPageContext } from "@/lib/page-context";
import { activateRequestWorkflow, addRequestWorkflowStep, cloneRequestWorkflow, deleteRequestWorkflowStep, updateRequestWorkflowStep } from "../../actions";

export const dynamic = "force-dynamic";

type WorkflowStep = {
  id: string;
  step_order: number;
  name_en: string;
  name_ar: string;
  approver_kind: "manager" | "owner" | "hr" | "role";
  role_id: string | null;
  approval_mode: "any" | "all" | "count";
  approvals_required: number;
  sla_hours: number | null;
};

type Workflow = {
  id: string;
  name_en: string;
  name_ar: string;
  version: number;
  is_active: boolean;
  activated_at: string | null;
  approval_workflow_steps: WorkflowStep[];
};

export default async function RequestWorkflowsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const { locale, dictionary: d, supabase, membership } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const tenantId = membership.tenant_id;
  const copy = locale === "ar" ? {
    back: "العودة إلى الطلبات", title: "مسارات اعتماد الطلبات", subtitle: "خصص من يعتمد كل نوع طلب، وبأي ترتيب، دون تغيير الطلبات الجاري تنفيذها.",
    versioning: "إصدارات آمنة", versioningHelp: "المسار النشط لا يتغير. أنشئ نسخة قابلة للتعديل، راجع خطواتها، ثم فعّلها للطلبات الجديدة فقط.",
    active: "نشط", draft: "مسودة", version: "الإصدار", steps: "خطوات", noSteps: "لا توجد خطوات", clone: "إنشاء نسخة جديدة", cloneHelp: "انسخ المسار النشط لتعديله بأمان.",
    nameEn: "الاسم بالإنجليزية", nameAr: "الاسم بالعربية", createDraft: "إنشاء نسخة مسودة", draftCreated: "تم إنشاء نسخة قابلة للتعديل.",
    activate: "تفعيل هذا الإصدار", activated: "تم تفعيل المسار للطلبات الجديدة.", activateConfirm: "تفعيل هذا المسار؟ سيظل كل طلب جارٍ على إصداره الحالي.",
    stepOrder: "الترتيب", stepNameEn: "اسم الخطوة بالإنجليزية", stepNameAr: "اسم الخطوة بالعربية", approver: "المعتمد", manager: "المدير المباشر", owner: "مالك الشركة", hr: "الموارد البشرية", role: "دور محدد",
    approvalMode: "قاعدة الاعتماد", any: "موافقة شخص واحد", all: "موافقة الجميع", count: "عدد محدد", requiredCount: "العدد المطلوب", slaHours: "المهلة بالساعات", chooseRole: "اختر دورًا",
    updateStep: "حفظ الخطوة", stepUpdated: "تم تحديث خطوة الموافقة.", deleteStep: "حذف", stepDeleted: "تم حذف الخطوة.", deleteConfirm: "حذف هذه الخطوة من المسودة؟", addStep: "إضافة خطوة", stepAdded: "تمت إضافة خطوة الموافقة.",
    immutable: "هذا الإصدار نشط ومحمي من التعديل.", drafts: "نسخ قيد الإعداد", noDrafts: "لا توجد مسودة حاليًا.", actionFailed: d.actionFailed, saving: d.saving,
  } : {
    back: "Back to requests", title: "Request approval workflows", subtitle: "Choose who approves each request type and in what order, without changing in-flight requests.",
    versioning: "Safe versioning", versioningHelp: "Active workflows stay immutable. Create an editable version, review its steps, then activate it for new requests only.",
    active: "Active", draft: "Draft", version: "Version", steps: "steps", noSteps: "No steps", clone: "Create new version", cloneHelp: "Copy the active workflow so it can be edited safely.",
    nameEn: "English name", nameAr: "Arabic name", createDraft: "Create draft version", draftCreated: "Editable workflow version created.",
    activate: "Activate this version", activated: "Workflow activated for new requests.", activateConfirm: "Activate this workflow? Existing requests remain on their current version.",
    stepOrder: "Order", stepNameEn: "English step name", stepNameAr: "Arabic step name", approver: "Approver", manager: "Line manager", owner: "Company owner", hr: "HR administrators", role: "Specific role",
    approvalMode: "Approval rule", any: "Any one person", all: "Everyone", count: "Specific count", requiredCount: "Required count", slaHours: "SLA hours", chooseRole: "Choose a role",
    updateStep: "Save step", stepUpdated: "Approval step updated.", deleteStep: "Delete", stepDeleted: "Approval step deleted.", deleteConfirm: "Delete this step from the draft?", addStep: "Add step", stepAdded: "Approval step added.",
    immutable: "This version is active and protected from editing.", drafts: "Versions in preparation", noDrafts: "No draft version yet.", actionFailed: d.actionFailed, saving: d.saving,
  };
  const [{ data: typeData, error }, { data: leaveTypeData, error: leaveTypeError }, { data: roles }, { data: canManageRequests }, { data: canManageLeave }] = await Promise.all([
    supabase.from("request_types").select("id, code, category, name_en, name_ar, description_en, description_ar, approval_workflows(id, name_en, name_ar, version, is_active, activated_at, approval_workflow_steps(id, step_order, name_en, name_ar, approver_kind, role_id, approval_mode, approvals_required, sla_hours))").eq("tenant_id", tenantId).order("category").order("name_en"),
    supabase.from("leave_types").select("id, code, name_en, name_ar, legal_summary_en, legal_summary_ar, approval_workflows(id, name_en, name_ar, version, is_active, activated_at, approval_workflow_steps(id, step_order, name_en, name_ar, approver_kind, role_id, approval_mode, approvals_required, sla_hours))").eq("tenant_id", tenantId).eq("is_active", true).order("name_en"),
    supabase.from("roles").select("id, name, description").eq("tenant_id", tenantId).order("name"),
    supabase.rpc("has_permission", { p_tenant_id: tenantId, p_permission: "requests.manage" }),
    supabase.rpc("has_permission", { p_tenant_id: tenantId, p_permission: "leave.manage" }),
  ]);
  if (error) throw error;
  if (leaveTypeError) throw leaveTypeError;
  const workflowSubjects = [
    ...(typeData ?? []),
    ...(leaveTypeData ?? []).map((type) => ({
      ...type,
      category: "leave",
      description_en: type.legal_summary_en,
      description_ar: type.legal_summary_ar,
    })),
  ];

  return <>
    <div className="page-head"><div><Link className="back-link" href={`/${locale}/requests`}>← {copy.back}</Link><h1 className="page-title">{copy.title}</h1><p className="muted">{copy.subtitle}</p></div></div>
    <section className="workflow-version-notice"><span aria-hidden="true">↻</span><div><strong>{copy.versioning}</strong><p>{copy.versioningHelp}</p></div></section>
    <div className="workflow-type-list">{workflowSubjects.map((type) => {
      const workflows = ([...(type.approval_workflows ?? [])] as Workflow[]).sort((a, b) => b.version - a.version);
      const active = workflows.find((workflow) => workflow.is_active);
      const drafts = workflows.filter((workflow) => !workflow.is_active);
      const canManageSubject = type.category === "leave" ? Boolean(canManageLeave) : Boolean(canManageRequests);
      const canManageWorkflows = canManageSubject;
      return <section className="card workflow-type-card" key={type.id}>
        <div className="workflow-type-head"><div><span className={`request-category request-category-${type.category}`}>{type.category}</span><h2>{locale === "ar" ? type.name_ar : type.name_en}</h2><p>{locale === "ar" ? type.description_ar : type.description_en}</p></div>{active ? <span className="badge status-active">{copy.active} · v{active.version}</span> : <span className="badge status-inactive">{copy.noSteps}</span>}</div>
        {active ? <div className="active-workflow-panel"><div className="workflow-path">{[...active.approval_workflow_steps].sort((a, b) => a.step_order - b.step_order).map((step, index) => <div className="workflow-path-part" key={step.id}><span>{step.step_order}</span><div><strong>{locale === "ar" ? step.name_ar : step.name_en}</strong><small>{copy[step.approver_kind]} · {copy[step.approval_mode]}</small></div>{index < active.approval_workflow_steps.length - 1 ? <i>→</i> : null}</div>)}</div><p className="immutable-note">{copy.immutable}</p></div> : null}
        {canManageWorkflows && active ? <div className="workflow-clone-action"><CreateDialog closeLabel={d.close} description={copy.immutable} eyebrow={copy.active} title={copy.clone} triggerLabel={copy.clone} width="medium"><ActionForm action={cloneRequestWorkflow.bind(null, locale, active.id)} className="form-grid compact-form" errorMessage={copy.actionFailed} pendingMessage={copy.saving} successMessage={copy.draftCreated}><div className="field"><label>{copy.nameEn}</label><input className="input" defaultValue={`${active.name_en} v${active.version + 1}`} name="nameEn" required /></div><div className="field"><label>{copy.nameAr}</label><input className="input" defaultValue={`${active.name_ar} ${active.version + 1}`} name="nameAr" required /></div><button className="button full" type="submit">{copy.createDraft}</button></ActionForm></CreateDialog></div> : null}
        {canManageWorkflows ? <div className="workflow-drafts"><h3>{copy.drafts}</h3>{drafts.map((workflow) => <article className="workflow-draft-card" key={workflow.id}>
          <div className="workflow-draft-head"><div><span className="badge status-pending">{copy.draft} · v{workflow.version}</span><h3>{locale === "ar" ? workflow.name_ar : workflow.name_en}</h3></div><ActionForm action={activateRequestWorkflow.bind(null, locale, workflow.id)} confirmMessage={copy.activateConfirm} errorMessage={copy.actionFailed} pendingMessage={copy.saving} successMessage={copy.activated}><button className="button" type="submit">{copy.activate}</button></ActionForm></div>
          <div className="workflow-step-editor">{[...workflow.approval_workflow_steps].sort((a, b) => a.step_order - b.step_order).map((step) => <div className="workflow-step-edit" key={step.id}><ActionForm action={updateRequestWorkflowStep.bind(null, locale, tenantId, step.id)} className="workflow-step-form" errorMessage={copy.actionFailed} pendingMessage={copy.saving} successMessage={copy.stepUpdated}><div className="field tiny-field"><label>{copy.stepOrder}</label><input className="input" defaultValue={step.step_order} min="1" max="50" name="stepOrder" type="number" required /></div><div className="field"><label>{copy.stepNameEn}</label><input className="input" defaultValue={step.name_en} name="nameEn" required /></div><div className="field"><label>{copy.stepNameAr}</label><input className="input" defaultValue={step.name_ar} name="nameAr" required /></div><div className="field"><label>{copy.approver}</label><select className="select" defaultValue={step.approver_kind} name="approverKind"><option value="manager">{copy.manager}</option><option value="owner">{copy.owner}</option><option value="hr">{copy.hr}</option><option value="role">{copy.role}</option></select></div><div className="field"><label>{copy.chooseRole}</label><select className="select" defaultValue={step.role_id ?? ""} name="roleId"><option value="">—</option>{roles?.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></div><div className="field"><label>{copy.approvalMode}</label><select className="select" defaultValue={step.approval_mode} name="approvalMode"><option value="any">{copy.any}</option><option value="all">{copy.all}</option><option value="count">{copy.count}</option></select></div><div className="field tiny-field"><label>{copy.requiredCount}</label><input className="input" defaultValue={step.approvals_required} min="1" max="50" name="approvalsRequired" type="number" /></div><div className="field tiny-field"><label>{copy.slaHours}</label><input className="input" defaultValue={step.sla_hours ?? ""} min="1" max="8760" name="slaHours" type="number" /></div><button className="button secondary" type="submit">{copy.updateStep}</button></ActionForm><ActionForm action={deleteRequestWorkflowStep.bind(null, locale, tenantId, step.id)} confirmMessage={copy.deleteConfirm} errorMessage={copy.actionFailed} pendingMessage={copy.saving} successMessage={copy.stepDeleted}><button className="button danger" type="submit">{copy.deleteStep}</button></ActionForm></div>)}</div>
          <div className="workflow-add-step-action"><CreateDialog closeLabel={d.close} description={locale === "ar" ? workflow.name_ar : workflow.name_en} eyebrow={copy.draft} title={copy.addStep} triggerLabel={`＋ ${copy.addStep}`}><ActionForm action={addRequestWorkflowStep.bind(null, locale, tenantId, workflow.id)} className="workflow-step-form" errorMessage={copy.actionFailed} pendingMessage={copy.saving} successMessage={copy.stepAdded}><div className="field tiny-field"><label>{copy.stepOrder}</label><input className="input" defaultValue={workflow.approval_workflow_steps.length + 1} min="1" max="50" name="stepOrder" type="number" required /></div><div className="field"><label>{copy.stepNameEn}</label><input className="input" name="nameEn" required /></div><div className="field"><label>{copy.stepNameAr}</label><input className="input" name="nameAr" required /></div><div className="field"><label>{copy.approver}</label><select className="select" defaultValue="manager" name="approverKind"><option value="manager">{copy.manager}</option><option value="owner">{copy.owner}</option><option value="hr">{copy.hr}</option><option value="role">{copy.role}</option></select></div><div className="field"><label>{copy.chooseRole}</label><select className="select" name="roleId"><option value="">—</option>{roles?.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></div><div className="field"><label>{copy.approvalMode}</label><select className="select" defaultValue="any" name="approvalMode"><option value="any">{copy.any}</option><option value="all">{copy.all}</option><option value="count">{copy.count}</option></select></div><div className="field tiny-field"><label>{copy.requiredCount}</label><input className="input" defaultValue="1" min="1" max="50" name="approvalsRequired" type="number" /></div><div className="field tiny-field"><label>{copy.slaHours}</label><input className="input" defaultValue="24" min="1" max="8760" name="slaHours" type="number" /></div><button className="button" type="submit">{copy.addStep}</button></ActionForm></CreateDialog></div>
        </article>)}{!drafts.length ? <div className="empty compact-empty">{copy.noDrafts}</div> : null}</div> : null}
      </section>;
    })}</div>
  </>;
}
