import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shiftly_employee/src/employee_context.dart';
import 'package:shiftly_employee/src/mobile_ui.dart';

class AttendancePage extends StatefulWidget {
  const AttendancePage({
    super.key,
    required this.locale,
    required this.demoMode,
  });
  final Locale locale;
  final bool demoMode;

  @override
  State<AttendancePage> createState() => _AttendancePageState();
}

class _AttendanceData {
  const _AttendanceData({
    required this.employee,
    required this.branch,
    required this.punches,
  });
  final EmployeeContext? employee;
  final Map<String, dynamic>? branch;
  final List<Map<String, dynamic>> punches;

  bool get enabled => branch?['mobile_clock_enabled'] == true;
  bool get requiresSelfie => branch?['attendance_selfie_required'] != false;
  bool get hasGeofence =>
      branch?['geofence_latitude'] != null &&
      branch?['geofence_longitude'] != null;
  String get nextPunch {
    if (punches.isEmpty) return 'check_in';
    return punches.first['punch_type'] == 'check_in' ? 'check_out' : 'check_in';
  }
}

class _AttendancePageState extends State<AttendancePage> {
  late Future<_AttendanceData> _data;
  bool _submitting = false;

  bool get _ar => widget.locale.languageCode == 'ar';

  @override
  void initState() {
    super.initState();
    _data = _load();
  }

  Future<_AttendanceData> _load() async {
    if (widget.demoMode) {
      return const _AttendanceData(employee: null, branch: null, punches: []);
    }
    final client = Supabase.instance.client;
    final employee = await EmployeeContext.load();
    if (employee == null) {
      return const _AttendanceData(employee: null, branch: null, punches: []);
    }
    Map<String, dynamic>? branch;
    if (employee.branchId != null) {
      final row = await client
          .from('branches')
          .select(
            'id, name_en, name_ar, mobile_clock_enabled, attendance_selfie_required, geofence_latitude, geofence_longitude, geofence_radius_metres',
          )
          .eq('id', employee.branchId!)
          .maybeSingle();
      branch = row == null ? null : Map<String, dynamic>.from(row);
    }
    final rows = await client
        .from('attendance_punches')
        .select(
          'id, work_date, punch_type, occurred_at, validation_status, distance_metres, within_geofence',
        )
        .eq('employee_id', employee.id)
        .order('occurred_at', ascending: false)
        .limit(20);
    return _AttendanceData(
      employee: employee,
      branch: branch,
      punches: (rows as List)
          .map((row) => Map<String, dynamic>.from(row as Map))
          .toList(),
    );
  }

  Future<Position> _position() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw StateError(
        _ar
            ? 'فعّل خدمة الموقع للمتابعة.'
            : 'Turn on location services to continue.',
      );
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      throw StateError(
        _ar
            ? 'يلزم السماح بالوصول إلى الموقع لتسجيل الحضور.'
            : 'Location permission is required to record attendance.',
      );
    }
    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 20),
      ),
    );
  }

  Future<XFile?> _selfie() {
    return ImagePicker().pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.front,
      imageQuality: 82,
      maxWidth: 1440,
    );
  }

  Future<void> _clock(_AttendanceData data) async {
    final employee = data.employee;
    if (_submitting || employee == null) return;
    setState(() => _submitting = true);
    String? uploadedPath;
    try {
      final selfie = data.requiresSelfie ? await _selfie() : null;
      if (data.requiresSelfie && selfie == null) return;
      final position = await _position();
      final client = Supabase.instance.client;
      if (selfie != null) {
        final bytes = await selfie.readAsBytes();
        uploadedPath =
            '${employee.tenantId}/${employee.id}/${DateTime.now().microsecondsSinceEpoch}.jpg';
        await client.storage
            .from('attendance-selfies')
            .uploadBinary(
              uploadedPath,
              Uint8List.fromList(bytes),
              fileOptions: FileOptions(
                contentType: selfie.mimeType ?? 'image/jpeg',
                upsert: false,
              ),
            );
      }
      await client.rpc(
        'record_attendance_punch',
        params: {
          'p_employee_id': employee.id,
          'p_punch_type': data.nextPunch,
          'p_occurred_at': DateTime.now().toUtc().toIso8601String(),
          'p_source': 'mobile',
          'p_branch_id': employee.branchId,
          'p_latitude': position.latitude,
          'p_longitude': position.longitude,
          'p_selfie_path': uploadedPath,
          'p_device_identifier':
              '${Platform.operatingSystem}:${Platform.operatingSystemVersion}',
        },
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          content: Text(
            data.nextPunch == 'check_in'
                ? (_ar ? 'تم تسجيل الحضور بنجاح.' : 'Checked in successfully.')
                : (_ar
                      ? 'تم تسجيل الانصراف بنجاح.'
                      : 'Checked out successfully.'),
          ),
        ),
      );
      setState(() => _data = _load());
    } catch (error) {
      if (uploadedPath != null) {
        await Supabase.instance.client.storage
            .from('attendance-selfies')
            .remove([uploadedPath])
            .catchError((_) => <FileObject>[]);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          backgroundColor: Theme.of(context).colorScheme.error,
          content: Text(
            error is StateError
                ? error.message
                : (_ar
                      ? 'تعذر تسجيل الحضور. حاول مرة أخرى.'
                      : 'Attendance could not be recorded. Please try again.'),
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  String _time(Object? value) {
    final date = DateTime.tryParse(value?.toString() ?? '')?.toLocal();
    if (date == null) return '—';
    final hour = date.hour.toString().padLeft(2, '0');
    final minute = date.minute.toString().padLeft(2, '0');
    return '$hour:$minute';
  }

  Future<void> _refresh() async {
    final next = _load();
    setState(() => _data = next);
    await next;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_ar ? 'الحضور والانصراف' : 'Clock in / out')),
      body: FutureBuilder<_AttendanceData>(
        future: _data,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return PageMessage(
              icon: Icons.cloud_off_rounded,
              title: _ar ? 'تعذر تحميل الحضور' : 'Attendance is unavailable',
              body: _ar
                  ? 'تحقق من اتصالك ثم حاول مرة أخرى.'
                  : 'Check your connection and try again.',
              action: FilledButton(
                onPressed: _refresh,
                child: Text(_ar ? 'إعادة المحاولة' : 'Try again'),
              ),
            );
          }
          final data = snapshot.data!;
          if (data.employee == null) {
            return PageMessage(
              icon: Icons.badge_outlined,
              title: _ar
                  ? 'الحساب غير مرتبط بموظف'
                  : 'Account not linked to an employee',
              body: _ar
                  ? 'اطلب من مسؤول الشركة ربط حسابك بملف الموظف.'
                  : 'Ask your company administrator to link your account to an employee profile.',
            );
          }
          if (data.branch == null || !data.enabled) {
            return PageMessage(
              icon: Icons.location_off_outlined,
              title: _ar
                  ? 'التسجيل عبر الهاتف غير متاح'
                  : 'Mobile attendance is unavailable',
              body: _ar
                  ? 'يلزم تعيين فرع يسمح بالتسجيل عبر الهاتف.'
                  : 'Your employee profile needs a branch with mobile attendance enabled.',
            );
          }
          final branchName = _ar
              ? (data.branch!['name_ar'] ?? data.branch!['name_en'])
              : data.branch!['name_en'];
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(18, 8, 18, 32),
              children: [
                Container(
                  padding: const EdgeInsets.all(22),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(26),
                    gradient: const LinearGradient(
                      colors: [Color(0xFF142448), Color(0xFF263F78)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  branchName?.toString() ?? '—',
                                  style: const TextStyle(
                                    color: Colors.white70,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: 7),
                                Text(
                                  data.nextPunch == 'check_in'
                                      ? (_ar
                                            ? 'جاهز لتسجيل الحضور'
                                            : 'Ready to clock in')
                                      : (_ar
                                            ? 'أنت داخل الوردية'
                                            : 'You are on shift'),
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 22,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Icon(
                            data.nextPunch == 'check_in'
                                ? Icons.login_rounded
                                : Icons.timelapse_rounded,
                            color: const Color(0xFF91A9FF),
                            size: 38,
                          ),
                        ],
                      ),
                      const SizedBox(height: 22),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: _submitting ? null : () => _clock(data),
                          style: FilledButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: const Color(0xFF1D3F9B),
                          ),
                          icon: _submitting
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : Icon(
                                  data.nextPunch == 'check_in'
                                      ? Icons.camera_alt_rounded
                                      : Icons.logout_rounded,
                                ),
                          label: Text(
                            _submitting
                                ? (_ar ? 'جاري التحقق…' : 'Verifying…')
                                : data.nextPunch == 'check_in'
                                ? (_ar ? 'تسجيل الحضور' : 'Clock in')
                                : (_ar ? 'تسجيل الانصراف' : 'Clock out'),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        data.hasGeofence
                            ? (_ar
                                  ? 'سيتم التحقق من الموقع والصورة وفق سياسة الفرع.'
                                  : 'Location and selfie evidence will be checked against branch policy.')
                            : (_ar
                                  ? 'سيتم حفظ الموقع والصورة كدليل للحضور.'
                                  : 'Location and selfie evidence will be saved with your punch.'),
                        style: const TextStyle(
                          color: Colors.white60,
                          fontSize: 12,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      _ar ? 'آخر التسجيلات' : 'Recent activity',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      '${data.punches.length}',
                      style: const TextStyle(
                        color: Color(0xFF7A8497),
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (data.punches.isEmpty)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(22),
                      child: Text(
                        _ar
                            ? 'لا توجد تسجيلات حضور حتى الآن.'
                            : 'No attendance punches yet.',
                        textAlign: TextAlign.center,
                      ),
                    ),
                  )
                else
                  ...data.punches.map(
                    (punch) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Card(
                        child: ListTile(
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 17,
                            vertical: 8,
                          ),
                          leading: CircleAvatar(
                            backgroundColor: const Color(0xFFEAF0FF),
                            child: Icon(
                              punch['punch_type'] == 'check_in'
                                  ? Icons.login_rounded
                                  : Icons.logout_rounded,
                              color: const Color(0xFF315BEA),
                            ),
                          ),
                          title: Text(
                            punch['punch_type'] == 'check_in'
                                ? (_ar ? 'حضور' : 'Clock in')
                                : (_ar ? 'انصراف' : 'Clock out'),
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                          subtitle: Text(
                            '${punch['work_date']} · ${_time(punch['occurred_at'])}${punch['distance_metres'] == null ? '' : ' · ${punch['distance_metres']} m'}',
                          ),
                          trailing: StatusPill(
                            punch['validation_status'] as String? ?? 'valid',
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}
