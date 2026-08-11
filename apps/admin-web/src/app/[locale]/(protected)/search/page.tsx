import Link from "next/link";
import { getTenantPageContext } from "@/lib/page-context";

export const dynamic = "force-dynamic";

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function SearchPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const { q = "" } = await searchParams;
  const { locale, dictionary: d, supabase, membership } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const copy = locale === "ar" ? {
    title: "البحث الشامل", subtitle: "ابحث في الأشخاص والجداول والطلبات والرواتب والمهام والإعلانات المسموح لك بعرضها.",
    placeholder: "اكتب اسمًا أو كودًا أو كلمة مفتاحية", search: "بحث", hint: "اكتب حرفين على الأقل. النتائج تحترم صلاحياتك ونطاق إدارتك تلقائيًا.",
    people: "الأشخاص", organization: "الهيكل التنظيمي", requests: "الطلبات", tasks: "المهام", announcements: "الإعلانات", payroll: "الرواتب", schedules: "الجداول", noResults: "لا توجد نتائج مطابقة.", resultsFor: "نتائج البحث عن", open: "فتح", status: "الحالة",
  } : {
    title: "Global search", subtitle: "Find people, schedules, requests, payroll, tasks, and announcements you are allowed to view.",
    placeholder: "Enter a name, code, or keyword", search: "Search", hint: "Type at least two characters. Results automatically respect your role and management scope.",
    people: "People", organization: "Organization", requests: "Requests", tasks: "Tasks", announcements: "Announcements", payroll: "Payroll", schedules: "Schedules", noResults: "No matching results.", resultsFor: "Results for", open: "Open", status: "Status",
  };
  const term = q.trim().slice(0, 80);
  const safeTerm = term.replace(/[^\p{L}\p{N}\s@.+-]/gu, " ").replace(/\s+/g, " ").trim();
  const pattern = `%${safeTerm}%`;

  let groups: Array<{ key: string; title: string; items: Array<{ id: string; title: string; detail: string; meta: string; href: string }> }> = [];
  if (safeTerm.length >= 2) {
    const dateMatch = /^\d{4}-\d{2}-\d{2}$/.test(safeTerm);
    const [employeesResult, branchesResult, teamsResult, requestsResult, tasksResult, announcementsResult, payrollResult, schedulesResult] = await Promise.all([
      supabase.from("employees").select("id,employee_code,name_en,name_ar,position,email,status,branches(name_en,name_ar)").eq("tenant_id", membership.tenant_id).or(`employee_code.ilike.${pattern},name_en.ilike.${pattern},name_ar.ilike.${pattern},position.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`).limit(8),
      supabase.from("branches").select("id,code,name_en,name_ar,is_active").eq("tenant_id", membership.tenant_id).or(`code.ilike.${pattern},name_en.ilike.${pattern},name_ar.ilike.${pattern}`).limit(6),
      supabase.from("teams").select("id,code,name_en,name_ar,is_active,branches(name_en,name_ar)").eq("tenant_id", membership.tenant_id).or(`code.ilike.${pattern},name_en.ilike.${pattern},name_ar.ilike.${pattern}`).limit(6),
      supabase.from("hr_requests").select("id,status,title,reason,submitted_at,employees(name_en,name_ar),request_types(name_en,name_ar)").eq("tenant_id", membership.tenant_id).or(`title.ilike.${pattern},reason.ilike.${pattern}`).order("submitted_at", { ascending: false }).limit(8),
      supabase.from("tasks").select("id,title_en,title_ar,priority,status,due_at").eq("tenant_id", membership.tenant_id).or(`title_en.ilike.${pattern},title_ar.ilike.${pattern},description_en.ilike.${pattern},description_ar.ilike.${pattern}`).order("due_at", { ascending: false }).limit(8),
      supabase.from("announcements").select("id,title_en,title_ar,priority,status,published_at,created_at").eq("tenant_id", membership.tenant_id).or(`title_en.ilike.${pattern},title_ar.ilike.${pattern},body_en.ilike.${pattern},body_ar.ilike.${pattern}`).order("created_at", { ascending: false }).limit(8),
      supabase.from("payroll_periods").select("id,code,name,status,period_start,period_end").eq("tenant_id", membership.tenant_id).or(`code.ilike.${pattern},name.ilike.${pattern}`).order("period_end", { ascending: false }).limit(6),
      dateMatch
        ? supabase.from("weekly_schedules").select("id,week_start,status,visibility,branches(name_en,name_ar)").eq("tenant_id", membership.tenant_id).eq("week_start", safeTerm).limit(8)
        : Promise.resolve({ data: [], error: null }),
    ]);
    for (const result of [employeesResult, branchesResult, teamsResult, requestsResult, tasksResult, announcementsResult, payrollResult, schedulesResult]) if (result.error) throw result.error;

    groups = [
      { key: "people", title: copy.people, items: (employeesResult.data ?? []).map((employee) => { const branch = one(employee.branches); return { id: employee.id, title: locale === "ar" && employee.name_ar ? employee.name_ar : employee.name_en, detail: `${employee.employee_code} · ${employee.position || copy.people}`, meta: `${branch ? (locale === "ar" && branch.name_ar ? branch.name_ar : branch.name_en) : "—"} · ${employee.status}`, href: `/${locale}/employees/${employee.id}` }; }) },
      { key: "organization", title: copy.organization, items: [
        ...(branchesResult.data ?? []).map((branch) => ({ id: `branch-${branch.id}`, title: locale === "ar" && branch.name_ar ? branch.name_ar : branch.name_en, detail: `${branch.code} · ${d.branches}`, meta: branch.is_active ? d.active : d.inactive, href: `/${locale}/employees?branch=${branch.id}` })),
        ...(teamsResult.data ?? []).map((team) => { const branch = one(team.branches); return { id: `team-${team.id}`, title: locale === "ar" && team.name_ar ? team.name_ar : team.name_en, detail: `${team.code} · ${d.teams}`, meta: branch ? (locale === "ar" && branch.name_ar ? branch.name_ar : branch.name_en) : d.allBranches, href: `/${locale}/teams` }; }),
      ] },
      { key: "requests", title: copy.requests, items: (requestsResult.data ?? []).map((request) => { const employee = one(request.employees); const type = one(request.request_types); return { id: request.id, title: request.title || (type ? (locale === "ar" ? type.name_ar : type.name_en) : copy.requests), detail: employee ? (locale === "ar" && employee.name_ar ? employee.name_ar : employee.name_en) : "—", meta: request.status, href: `/${locale}/requests?request=${request.id}#request-${request.id}` }; }) },
      { key: "tasks", title: copy.tasks, items: (tasksResult.data ?? []).map((task) => ({ id: task.id, title: locale === "ar" && task.title_ar ? task.title_ar : task.title_en, detail: task.priority, meta: task.status, href: `/${locale}/tasks/${task.id}` })) },
      { key: "announcements", title: copy.announcements, items: (announcementsResult.data ?? []).map((announcement) => ({ id: announcement.id, title: locale === "ar" && announcement.title_ar ? announcement.title_ar : announcement.title_en, detail: announcement.priority, meta: announcement.status, href: `/${locale}/announcements#announcement-${announcement.id}` })) },
      { key: "payroll", title: copy.payroll, items: (payrollResult.data ?? []).map((period) => ({ id: period.id, title: period.name, detail: period.code, meta: `${period.period_start} → ${period.period_end} · ${period.status}`, href: `/${locale}/payroll/${period.id}` })) },
      { key: "schedules", title: copy.schedules, items: (schedulesResult.data ?? []).map((schedule) => { const branch = one(schedule.branches); return { id: schedule.id, title: branch ? (locale === "ar" && branch.name_ar ? branch.name_ar : branch.name_en) : copy.schedules, detail: schedule.week_start, meta: schedule.status, href: `/${locale}/schedules/${schedule.id}` }; }) },
    ].filter((group) => group.items.length);
  }
  const resultCount = groups.reduce((sum, group) => sum + group.items.length, 0);

  return <>
    <div className="page-head"><div><span className="eyebrow">{copy.search}</span><h1 className="page-title">{copy.title}</h1><p className="muted">{copy.subtitle}</p></div></div>
    <section className="search-hero card"><form action={`/${locale}/search`} className="search-page-form" method="get"><svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg><input autoFocus className="input" defaultValue={term} maxLength={80} minLength={2} name="q" placeholder={copy.placeholder} required /><button className="button" type="submit">{copy.search}</button></form><p>{copy.hint}</p></section>
    {safeTerm.length >= 2 ? <div className="search-result-heading"><strong>{copy.resultsFor} “{term}”</strong><span>{resultCount}</span></div> : null}
    <section className="search-result-groups">{groups.map((group) => <article className="card search-group" key={group.key}><div className="card-heading"><div><h2>{group.title}</h2><p className="muted">{group.items.length} {copy.open.toLowerCase()}</p></div></div><div className="search-result-list">{group.items.map((item) => <Link href={item.href} key={item.id}><span className="search-result-icon">{item.title.slice(0, 1).toUpperCase()}</span><span><strong>{item.title}</strong><small>{item.detail}</small></span><span className="search-result-meta">{item.meta}</span><i>→</i></Link>)}</div></article>)}{safeTerm.length >= 2 && !groups.length ? <div className="card empty">{copy.noResults}</div> : null}</section>
  </>;
}
