-- Shiftly HR Milestone 2: expose RLS-protected tables through the Supabase API.
--
-- PostgreSQL privileges and Row-Level Security are separate gates. The
-- authenticated role needs table privileges before its RLS policies can apply,
-- while service_role needs full access for trusted seed/import and maintenance
-- jobs.

grant select, insert, update, delete on table
  public.profiles,
  public.tenants,
  public.tenant_settings,
  public.permissions,
  public.roles,
  public.role_permissions,
  public.memberships,
  public.membership_roles,
  public.branches,
  public.teams,
  public.employees,
  public.employee_assignments,
  public.shift_templates,
  public.weekly_schedules,
  public.schedule_entries
to authenticated;

grant select on table
  public.audit_logs,
  public.schedule_status_events
to authenticated;

grant all privileges on table
  public.profiles,
  public.tenants,
  public.tenant_settings,
  public.permissions,
  public.roles,
  public.role_permissions,
  public.memberships,
  public.membership_roles,
  public.branches,
  public.teams,
  public.employees,
  public.audit_logs,
  public.employee_assignments,
  public.shift_templates,
  public.weekly_schedules,
  public.schedule_entries,
  public.schedule_status_events
to service_role;

grant usage, select on all sequences in schema public to service_role;

-- Preserve append-only history even if this migration is replayed after a
-- broader grant.
revoke insert, update, delete on public.audit_logs from anon, authenticated;
revoke insert, update, delete on public.schedule_status_events from anon, authenticated;
