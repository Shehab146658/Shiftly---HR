import Link from "next/link";
import { notFound } from "next/navigation";
import { updateOwnProfile } from "../../actions";
import { ActionForm } from "@/components/action-form";
import { AppIcon } from "@/components/brand-mark";
import { getTenantPageContext } from "@/lib/page-context";

function roleName(name: string) {
  return name.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function UserProfilePage({ params }: { params: Promise<{ locale: string; userId: string }> }) {
  const { locale: rawLocale, userId } = await params;
  const { locale, dictionary: d, supabase, user, membership } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;

  const [{ data: profile, error: profileError }, { data: targetMembership, error: membershipError }, { data: linkedEmployee }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, locale, created_at, updated_at").eq("id", userId).maybeSingle(),
    supabase.from("memberships").select("id, user_id, status, is_owner, joined_at, created_at, membership_roles(roles(id, name, description))").eq("tenant_id", membership.tenant_id).eq("user_id", userId).maybeSingle(),
    supabase.from("employees").select("id, employee_code, name_en, name_ar, position, status").eq("tenant_id", membership.tenant_id).eq("user_id", userId).maybeSingle(),
  ]);
  if (profileError) throw profileError;
  if (membershipError) throw membershipError;
  if (!profile || !targetMembership) notFound();

  const isSelf = user.id === userId;
  const displayName = profile.full_name?.trim() || (isSelf ? user.email : null) || d.companyUser;
  const initials = String(displayName).split(/\s+/).slice(0, 2).map((part: string) => part[0]).join("").toUpperCase();
  const assignedRoles = targetMembership.membership_roles.flatMap((assignment) => {
    const role = Array.isArray(assignment.roles) ? assignment.roles[0] : assignment.roles;
    return role ? [role] : [];
  });
  const profileAction = updateOwnProfile.bind(null, locale);

  return <>
    <div className="page-head profile-page-head">
      <div><Link className="text-link" href={`/${locale}/dashboard`}>← {d.dashboard}</Link><h1 className="page-title">{d.userProfile}</h1><p className="muted">{d.userProfileHelp}</p></div>
      {isSelf ? <span className="badge profile-self-badge">{d.yourProfile}</span> : null}
    </div>

    <section className="profile-hero card">
      <div className="profile-avatar-large">{initials || "U"}</div>
      <div className="profile-identity"><span className="eyebrow">{targetMembership.is_owner ? d.companyOwner : d.companyUser}</span><h2>{displayName}</h2><p>{isSelf ? user.email : d.companyMember}</p><div className="profile-role-list">{assignedRoles.map((role) => <Link className="badge role-system-badge" href={`/${locale}/roles/${role.id}`} key={role.id}>{roleName(role.name)}</Link>)}</div></div>
      <div className="profile-status-card"><AppIcon name="profile" /><span>{d.accountStatus}</span><strong>{targetMembership.status === "active" ? d.active : targetMembership.status}</strong></div>
    </section>

    <div className="profile-layout section-gap">
      <section className="card stack">
        <div className="card-heading"><div><h2>{d.profileDetails}</h2><p className="muted">{isSelf ? d.profileEditHelp : d.profileReadOnlyHelp}</p></div></div>
        {isSelf ? <ActionForm action={profileAction} className="form-grid" errorMessage={d.actionFailed} pendingMessage={d.saving} successMessage={d.profileUpdated}>
          <div className="field"><label>{d.fullName}</label><input className="input" defaultValue={profile.full_name ?? ""} name="fullName" required /></div>
          <div className="field"><label>{d.preferredLanguage}</label><select className="select" defaultValue={profile.locale} name="profileLocale"><option value="en">English</option><option value="ar">العربية</option></select></div>
          <div className="full"><button className="button" type="submit">{d.saveProfile}</button></div>
        </ActionForm> : <dl className="profile-detail-list"><div><dt>{d.fullName}</dt><dd>{displayName}</dd></div><div><dt>{d.preferredLanguage}</dt><dd>{profile.locale === "ar" ? "العربية" : "English"}</dd></div></dl>}
      </section>

      <aside className="card stack">
        <div className="card-heading"><div><h2>{d.companyAccess}</h2><p className="muted">{d.companyAccessHelp}</p></div></div>
        <dl className="profile-detail-list">
          <div><dt>{d.joined}</dt><dd>{new Date(targetMembership.joined_at ?? targetMembership.created_at).toLocaleDateString(locale)}</dd></div>
          <div><dt>{d.accessRoles}</dt><dd>{assignedRoles.length || 0}</dd></div>
          <div><dt>{d.employeeAccount}</dt><dd>{linkedEmployee ? <Link className="text-link" href={`/${locale}/employees/${linkedEmployee.id}`}>{locale === "ar" && linkedEmployee.name_ar ? linkedEmployee.name_ar : linkedEmployee.name_en} · {linkedEmployee.employee_code}</Link> : d.notLinked}</dd></div>
        </dl>
      </aside>
    </div>
  </>;
}
