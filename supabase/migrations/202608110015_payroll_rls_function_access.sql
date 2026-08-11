-- RLS policies invoke this guarded helper as the authenticated caller.
grant execute on function public.can_view_payroll_employee(uuid,uuid) to authenticated;
revoke execute on function public.can_view_payroll_employee(uuid,uuid) from public,anon;
