import Link from "next/link";
import { TaskComposer } from "@/components/task-composer";
import { getTenantPageContext } from "@/lib/page-context";
import { createOperationalTask } from "../actions";

export const dynamic = "force-dynamic";

function localInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default async function TasksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const { locale, dictionary: d, supabase, membership } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const tenantId = membership.tenant_id;
  const copy = locale === "ar" ? {
    title: "مركز المهام", subtitle: "حوّل العمل اليومي إلى مهام واضحة قابلة للمتابعة مع إثبات الإنجاز والاعتماد.", newTask: "إسناد مهمة جديدة", open: "مفتوحة", dueSoon: "تستحق خلال 48 ساعة", overdue: "متأخرة", completed: "مكتملة", assignments: "موظف", progress: "التقدم", due: "الموعد النهائي", recurring: "متكررة", evidence: "تحتاج إثبات", empty: "لا توجد مهام في نطاقك بعد.", view: "فتح المهمة", allWork: "كل العمل التشغيلي",
  } : {
    title: "Task operations", subtitle: "Turn daily work into accountable assignments with evidence, review, and a clear delivery history.", newTask: "Assign a new task", open: "Open", dueSoon: "Due within 48 hours", overdue: "Overdue", completed: "Completed", assignments: "people", progress: "Progress", due: "Due", recurring: "Recurring", evidence: "Evidence required", empty: "No tasks are visible in your scope yet.", view: "Open task", allWork: "All operational work",
  };
  const [{ data: canCreate }, { data: employees, error: employeeError }, { data: teams, error: teamError }, { data: branches, error: branchError }, { data: tasks, error: taskError }, { data: assignments, error: assignmentError }] = await Promise.all([
    supabase.rpc("has_permission", { p_tenant_id: tenantId, p_permission: "tasks.create" }),
    supabase.from("employees").select("id,employee_code,name_en,name_ar,position,branch_id,team_id,status").eq("tenant_id", tenantId).neq("status", "terminated").order("name_en"),
    supabase.from("teams").select("id,code,name_en,name_ar").eq("tenant_id", tenantId).eq("is_active", true).order("name_en"),
    supabase.from("branches").select("id,code,name_en,name_ar").eq("tenant_id", tenantId).eq("is_active", true).order("name_en"),
    supabase.from("tasks").select("id,title_en,title_ar,priority,start_at,due_at,require_evidence,recurrence,occurrence_number,status,created_at").eq("tenant_id", tenantId).order("due_at", { ascending: true }).limit(200),
    supabase.from("task_assignments").select("id,task_id,employee_id,status").eq("tenant_id", tenantId),
  ]);
  for (const error of [employeeError, teamError, branchError, taskError, assignmentError]) if (error) throw error;
  const now = new Date().getTime(); const soon = now + 48 * 60 * 60 * 1000;
  const rows = tasks ?? []; const assignmentRows = assignments ?? [];
  const activeRows = rows.filter((task) => !["approved", "cancelled"].includes(task.status));
  const overdue = activeRows.filter((task) => new Date(task.due_at).getTime() < now).length;
  const dueSoon = activeRows.filter((task) => { const due = new Date(task.due_at).getTime(); return due >= now && due <= soon; }).length;
  const start = new Date(); start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0); const due = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const employeeMap = new Map((employees ?? []).map((employee) => [employee.id, employee]));
  return <>
    <div className="page-head"><div><h1 className="page-title">{copy.title}</h1><p className="muted">{copy.subtitle}</p></div></div>
    <section className="stats-grid collaboration-stats"><a className="stat-card" href="#task-board"><span>{copy.open}</span><strong>{activeRows.length}</strong><small>{copy.allWork}</small></a><a className="stat-card" href="#task-board"><span>{copy.dueSoon}</span><strong>{dueSoon}</strong><small>48h</small></a><a className="stat-card danger-stat" href="#task-board"><span>{copy.overdue}</span><strong>{overdue}</strong><small>{copy.due}</small></a><a className="stat-card" href="#task-board"><span>{copy.completed}</span><strong>{rows.filter((task) => task.status === "approved").length}</strong><small>{copy.progress}</small></a></section>
    {canCreate ? <section className="card stack section-gap"><details className="business-create-panel"><summary><span><strong>{copy.newTask}</strong><small>{copy.subtitle}</small></span><span className="button small-button">{d.add}</span></summary><TaskComposer action={createOperationalTask.bind(null, locale, tenantId)} branches={(branches ?? []).map((branch) => ({ id: branch.id, label: locale === "ar" && branch.name_ar ? branch.name_ar : branch.name_en, meta: branch.code }))} defaults={{ startAt: localInput(start), dueAt: localInput(due) }} employees={(employees ?? []).map((employee) => ({ id: employee.id, label: locale === "ar" && employee.name_ar ? employee.name_ar : employee.name_en, meta: `${employee.employee_code} · ${employee.position ?? d.noPosition}` }))} locale={locale} teams={(teams ?? []).map((team) => ({ id: team.id, label: locale === "ar" && team.name_ar ? team.name_ar : team.name_en, meta: team.code }))} /></details></section> : null}
    <section className="task-board section-gap" id="task-board">{rows.map((task) => { const taskAssignments = assignmentRows.filter((assignment) => assignment.task_id === task.id); const approved = taskAssignments.filter((assignment) => assignment.status === "approved").length; const percent = taskAssignments.length ? Math.round(approved / taskAssignments.length * 100) : 0; const isOverdue = !["approved", "cancelled"].includes(task.status) && new Date(task.due_at).getTime() < now; const people = taskAssignments.slice(0, 4).map((assignment) => employeeMap.get(assignment.employee_id)).filter(Boolean); return <article className={`card task-card task-priority-${task.priority}`} key={task.id}><div className="task-card-head"><div><span className={`badge task-status-${isOverdue ? "overdue" : task.status}`}>{isOverdue ? copy.overdue : task.status.replaceAll("_", " ")}</span><span className={`badge task-priority-badge-${task.priority}`}>{task.priority}</span></div><time>{new Date(task.due_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</time></div><h2>{locale === "ar" && task.title_ar ? task.title_ar : task.title_en}</h2><div className="task-card-meta">{task.recurrence !== "none" ? <span>{copy.recurring} · {task.recurrence} #{task.occurrence_number}</span> : null}{task.require_evidence ? <span>{copy.evidence}</span> : null}</div><div className="task-assignee-row"><div className="avatar-stack">{people.map((employee) => <span className="person-avatar mini-avatar" key={employee!.id} title={employee!.name_en}>{employee!.name_en.slice(0, 1)}</span>)}</div><span>{taskAssignments.length} {copy.assignments}</span></div><div className="target-progress-label"><span>{copy.progress}</span><strong>{approved}/{taskAssignments.length}</strong></div><div className="target-progress"><span style={{ width: `${percent}%` }} /></div><Link className="button secondary" href={`/${locale}/tasks/${task.id}`}>{copy.view} →</Link></article>; })}{!rows.length ? <div className="card empty">{copy.empty}</div> : null}</section>
  </>;
}
