from pathlib import Path
import json, re, sys

root = Path(__file__).resolve().parents[1]
errors = []
ignored_parts = {'.git', '.next', '.dart_tool', 'build', 'coverage', 'node_modules'}

for path in root.rglob('package.json'):
    if ignored_parts.intersection(path.relative_to(root).parts):
        continue
    try:
        json.loads(path.read_text(encoding='utf-8'))
    except Exception as exc:
        errors.append(f'{path.relative_to(root)}: invalid JSON: {exc}')

foundation = (root / 'supabase/migrations/202607260001_foundation.sql').read_text(encoding='utf-8')
scheduling = (root / 'supabase/migrations/202607260002_employees_scheduling.sql').read_text(encoding='utf-8')
api_privileges = (root / 'supabase/migrations/202607260003_api_privileges.sql').read_text(encoding='utf-8')
employee_roles = (root / 'supabase/migrations/202607260004_employee_role_assignments.sql').read_text(encoding='utf-8')
default_employee_roles = (root / 'supabase/migrations/202607260005_default_employee_roles.sql').read_text(encoding='utf-8')
role_permission_management = (root / 'supabase/migrations/202607260006_role_permission_management.sql').read_text(encoding='utf-8')
member_profiles = (root / 'supabase/migrations/202607260007_member_profiles_and_team_assignment.sql').read_text(encoding='utf-8')
required = {
    'foundation': (foundation, ['enable row level security', 'create_tenant_with_owner', 'has_permission', 'capture_audit_log']),
    'scheduling': (scheduling, [
        'employee_assignments', 'shift_templates', 'weekly_schedules', 'schedule_entries',
        'shift_duration_minutes', 'can_manage_schedule_branch', 'can_view_weekly_schedule',
        'set_weekly_schedule_status', 'copy_weekly_schedule',
    ]),
    'api privileges': (api_privileges, [
        'to authenticated', 'to service_role', 'public.schedule_entries',
        'revoke insert, update, delete on public.audit_logs',
    ]),
    'employee roles': (employee_roles, [
        'employee_role_assignments', 'set_employee_roles',
        'sync_employee_role_to_membership', 'enable row level security',
        'Company ownership must be managed from owner membership settings',
    ]),
    'default employee roles': (default_employee_roles, [
        'assign_default_employee_role', "r.name = 'employee'",
        'on conflict (employee_id, role_id) do nothing',
    ]),
    'role permission management': (role_permission_management, [
        'set_role_permissions', 'Owner permissions are protected',
        "'role_permissions'", 'grant execute',
    ]),
    'member profiles and team assignment': (member_profiles, [
        'can_view_tenant_profile', 'profiles_select_tenant_members',
        'assign_all_employees_to_team', 'set branch_id = null',
        'grant execute',
    ]),
}
for name, (migration, tokens) in required.items():
    for token in tokens:
        if token not in migration:
            errors.append(f'{name} migration missing required token: {token}')

for path in root.rglob('*'):
    if ignored_parts.intersection(path.relative_to(root).parts):
        continue
    if path.is_file():
        text = path.read_text(encoding='utf-8', errors='ignore')
        if re.search(r'(service_role|secret_key)\s*=\s*["\'][A-Za-z0-9._-]{20,}', text, re.I):
            errors.append(f'possible committed secret: {path.relative_to(root)}')

mobile_schedule = (root / 'apps/employee-mobile/lib/src/schedule_page.dart').read_text(encoding='utf-8')
if 'currentScheduleWindow' not in mobile_schedule or ".gte('week_start'" not in mobile_schedule:
    errors.append('mobile schedule lookup must support configurable branch week starts')

if errors:
    print('\n'.join(errors))
    sys.exit(1)
print('Static checks passed.')
