import 'package:supabase_flutter/supabase_flutter.dart';

class EmployeeContext {
  const EmployeeContext({
    required this.id,
    required this.tenantId,
    required this.employeeNumber,
    required this.nameEn,
    required this.nameAr,
    this.branchId,
  });

  final String id;
  final String tenantId;
  final String employeeNumber;
  final String nameEn;
  final String? nameAr;
  final String? branchId;

  String displayName(bool arabic) =>
      arabic && (nameAr?.trim().isNotEmpty ?? false) ? nameAr! : nameEn;

  static Future<EmployeeContext?> load() async {
    final client = Supabase.instance.client;
    final userId = client.auth.currentUser?.id;
    if (userId == null) return null;
    final row = await client
        .from('employees')
        .select('id, tenant_id, employee_number, name_en, name_ar, branch_id')
        .eq('user_id', userId)
        .neq('status', 'terminated')
        .maybeSingle();
    if (row == null) return null;
    return EmployeeContext(
      id: row['id'] as String,
      tenantId: row['tenant_id'] as String,
      employeeNumber: row['employee_number'] as String,
      nameEn: row['name_en'] as String,
      nameAr: row['name_ar'] as String?,
      branchId: row['branch_id'] as String?,
    );
  }
}
