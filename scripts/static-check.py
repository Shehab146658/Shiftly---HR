from pathlib import Path
import json, re, sys

root = Path(__file__).resolve().parents[1]
errors = []

for path in root.rglob('package.json'):
    try:
        json.loads(path.read_text(encoding='utf-8'))
    except Exception as exc:
        errors.append(f'{path.relative_to(root)}: invalid JSON: {exc}')

foundation = (root / 'supabase/migrations/202607260001_foundation.sql').read_text(encoding='utf-8')
scheduling = (root / 'supabase/migrations/202607260002_employees_scheduling.sql').read_text(encoding='utf-8')
required = {
    'foundation': (foundation, ['enable row level security', 'create_tenant_with_owner', 'has_permission', 'capture_audit_log']),
    'scheduling': (scheduling, ['employee_assignments', 'shift_templates', 'weekly_schedules', 'schedule_entries', 'set_weekly_schedule_status', 'copy_weekly_schedule']),
}
for name, (migration, tokens) in required.items():
    for token in tokens:
        if token not in migration:
            errors.append(f'{name} migration missing required token: {token}')

for path in root.rglob('*'):
    if path.is_file() and '.git' not in path.parts:
        text = path.read_text(encoding='utf-8', errors='ignore')
        if re.search(r'(service_role|secret_key)\s*=\s*["\'][A-Za-z0-9._-]{20,}', text, re.I):
            errors.append(f'possible committed secret: {path.relative_to(root)}')

if errors:
    print('\n'.join(errors))
    sys.exit(1)
print('Static checks passed.')
