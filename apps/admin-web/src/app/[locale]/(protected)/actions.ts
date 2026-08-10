"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppLocale } from "@/lib/i18n";

const idSchema = z.string().uuid();
const codeSchema = z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9_-]+$/);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const optionalId = z.string().uuid().optional();
const permissionKeySchema = z.string().trim().min(2).max(100).regex(/^[a-z0-9_.-]+$/);

function optionalString(value: FormDataEntryValue | null) {
  const result = String(value ?? "").trim();
  return result || undefined;
}

export async function signOut(locale: AppLocale) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(`/${locale}/login`);
}

export async function createTenant(locale: AppLocale, formData: FormData) {
  const values = z.object({
    nameEn: z.string().trim().min(2).max(150),
    nameAr: z.string().trim().max(150).optional(),
    slug: z.string().trim().min(3).max(60).regex(/^[a-z0-9-]+$/),
    timezone: z.string().trim().min(3).max(80),
  }).parse({
    nameEn: formData.get("nameEn"),
    nameAr: optionalString(formData.get("nameAr")),
    slug: formData.get("slug"),
    timezone: formData.get("timezone"),
  });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_tenant_with_owner", {
    p_name_en: values.nameEn,
    p_name_ar: values.nameAr ?? null,
    p_slug: values.slug,
    p_timezone: values.timezone,
  });
  if (error) throw error;
  revalidatePath(`/${locale}/dashboard`);
}

export async function createBranch(locale: AppLocale, tenantId: string, formData: FormData) {
  const values = z.object({
    code: codeSchema,
    nameEn: z.string().trim().min(2).max(150),
    nameAr: z.string().trim().max(150).optional(),
  }).parse({
    code: formData.get("code"),
    nameEn: formData.get("nameEn"),
    nameAr: optionalString(formData.get("nameAr")),
  });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("branches").insert({
    tenant_id: idSchema.parse(tenantId),
    code: values.code.toUpperCase(),
    name_en: values.nameEn,
    name_ar: values.nameAr ?? null,
  });
  if (error) throw error;
  revalidatePath(`/${locale}/branches`);
}

export async function updateBranchSchedulingRules(locale: AppLocale, tenantId: string, branchId: string, formData: FormData) {
  const values = z.object({
    operationalDayStart: timeSchema,
    maximumShiftHours: z.coerce.number().int().min(1).max(24),
    weekStartIsodow: z.coerce.number().int().min(1).max(7),
    weeklyRestIsodows: z.array(z.coerce.number().int().min(1).max(7)).min(1).max(6),
    isIndustrialEstablishment: z.boolean(),
    defaultScheduleVisibility: z.enum(["self", "team", "branch", "all"]),
    lateGraceMinutes: z.coerce.number().int().min(0).max(240),
    earlyDepartureGraceMinutes: z.coerce.number().int().min(0).max(240),
    overtimeThresholdMinutes: z.coerce.number().int().min(0).max(480),
    geofenceLatitude: z.coerce.number().min(-90).max(90).optional(),
    geofenceLongitude: z.coerce.number().min(-180).max(180).optional(),
    geofenceRadiusMetres: z.coerce.number().int().min(20).max(5000),
    mobileClockEnabled: z.boolean(),
    attendanceSelfieRequired: z.boolean(),
  }).parse({
    operationalDayStart: formData.get("operationalDayStart"),
    maximumShiftHours: formData.get("maximumShiftHours"),
    weekStartIsodow: formData.get("weekStartIsodow"),
    weeklyRestIsodows: formData.getAll("weeklyRestIsodows"),
    isIndustrialEstablishment: formData.get("isIndustrialEstablishment") === "on",
    defaultScheduleVisibility: formData.get("defaultScheduleVisibility"),
    lateGraceMinutes: formData.get("lateGraceMinutes") || "0",
    earlyDepartureGraceMinutes: formData.get("earlyDepartureGraceMinutes") || "0",
    overtimeThresholdMinutes: formData.get("overtimeThresholdMinutes") || "30",
    geofenceLatitude: optionalString(formData.get("geofenceLatitude")),
    geofenceLongitude: optionalString(formData.get("geofenceLongitude")),
    geofenceRadiusMetres: formData.get("geofenceRadiusMetres") || "150",
    mobileClockEnabled: formData.get("mobileClockEnabled") === "on",
    attendanceSelfieRequired: formData.get("attendanceSelfieRequired") === "on",
  });
  if ((values.geofenceLatitude === undefined) !== (values.geofenceLongitude === undefined)) {
    throw new Error("Enter both branch latitude and longitude, or leave both empty.");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("branches").update({
    operational_day_start: values.operationalDayStart,
    maximum_shift_hours: values.maximumShiftHours,
    week_start_isodow: values.weekStartIsodow,
    weekly_rest_isodows: values.weeklyRestIsodows,
    is_industrial_establishment: values.isIndustrialEstablishment,
    default_schedule_visibility: values.defaultScheduleVisibility,
    late_grace_minutes: values.lateGraceMinutes,
    early_departure_grace_minutes: values.earlyDepartureGraceMinutes,
    overtime_threshold_minutes: values.overtimeThresholdMinutes,
    geofence_latitude: values.geofenceLatitude ?? null,
    geofence_longitude: values.geofenceLongitude ?? null,
    geofence_radius_metres: values.geofenceRadiusMetres,
    mobile_clock_enabled: values.mobileClockEnabled,
    attendance_selfie_required: values.attendanceSelfieRequired,
  }).eq("tenant_id", idSchema.parse(tenantId)).eq("id", idSchema.parse(branchId));
  if (error) throw error;
  revalidatePath(`/${locale}/branches`);
}

export async function createTeam(locale: AppLocale, tenantId: string, formData: FormData) {
  const values = z.object({
    code: codeSchema,
    nameEn: z.string().trim().min(2).max(150),
    nameAr: z.string().trim().max(150).optional(),
    branchId: optionalId,
  }).parse({
    code: formData.get("code"),
    nameEn: formData.get("nameEn"),
    nameAr: optionalString(formData.get("nameAr")),
    branchId: optionalString(formData.get("branchId")),
  });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("teams").insert({
    tenant_id: idSchema.parse(tenantId),
    branch_id: values.branchId ?? null,
    code: values.code.toUpperCase(),
    name_en: values.nameEn,
    name_ar: values.nameAr ?? null,
  });
  if (error) throw error;
  revalidatePath(`/${locale}/teams`);
}

export async function assignAllEmployeesToTeam(locale: AppLocale, tenantId: string, teamId: string, _formData?: FormData) {
  void _formData;
  idSchema.parse(tenantId);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("assign_all_employees_to_team", {
    p_team_id: idSchema.parse(teamId),
  });
  if (error) throw error;
  revalidatePath(`/${locale}/dashboard`);
  revalidatePath(`/${locale}/teams`);
  revalidatePath(`/${locale}/employees`);
  revalidatePath(`/${locale}/audit`);
}

export async function updateOwnProfile(locale: AppLocale, formData: FormData) {
  const values = z.object({
    fullName: z.string().trim().min(2).max(150),
    profileLocale: z.enum(["en", "ar"]),
  }).parse({
    fullName: formData.get("fullName"),
    profileLocale: formData.get("profileLocale"),
  });
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw authError ?? new Error("Authentication required");
  const { error } = await supabase.from("profiles").update({
    full_name: values.fullName,
    locale: values.profileLocale,
  }).eq("id", authData.user.id);
  if (error) throw error;
  revalidatePath(`/${locale}/profiles/${authData.user.id}`);
}

const employeeFormSchema = z.object({
  employeeCode: codeSchema,
  nameEn: z.string().trim().min(2).max(150),
  nameAr: z.string().trim().max(150).optional(),
  position: z.string().trim().max(150).optional(),
  email: z.string().email().max(254).optional(),
  phone: z.string().trim().max(40).optional(),
  preferredLocale: z.enum(["en", "ar"]),
  status: z.enum(["active", "inactive", "on_leave", "terminated"]),
  hireDate: dateSchema.optional(),
  birthDate: dateSchema.optional(),
  gender: z.enum(["female", "male", "unspecified"]),
  priorServiceYears: z.coerce.number().min(0).max(100),
  isPersonWithDisability: z.boolean(),
  isDwarf: z.boolean(),
  worksHazardous: z.boolean(),
  worksUnhealthy: z.boolean(),
  worksRemoteLocation: z.boolean(),
  branchId: optionalId,
  teamId: optionalId,
  managerEmployeeId: optionalId,
  notes: z.string().trim().max(2000).optional(),
});

function parseEmployeeForm(formData: FormData) {
  return employeeFormSchema.parse({
    employeeCode: formData.get("employeeCode"),
    nameEn: formData.get("nameEn"),
    nameAr: optionalString(formData.get("nameAr")),
    position: optionalString(formData.get("position")),
    email: optionalString(formData.get("email")),
    phone: optionalString(formData.get("phone")),
    preferredLocale: formData.get("preferredLocale") || "en",
    status: formData.get("status") || "active",
    hireDate: optionalString(formData.get("hireDate")),
    birthDate: optionalString(formData.get("birthDate")),
    gender: formData.get("gender") || "unspecified",
    priorServiceYears: formData.get("priorServiceYears") || "0",
    isPersonWithDisability: formData.get("isPersonWithDisability") === "on",
    isDwarf: formData.get("isDwarf") === "on",
    worksHazardous: formData.get("worksHazardous") === "on",
    worksUnhealthy: formData.get("worksUnhealthy") === "on",
    worksRemoteLocation: formData.get("worksRemoteLocation") === "on",
    branchId: optionalString(formData.get("branchId")),
    teamId: optionalString(formData.get("teamId")),
    managerEmployeeId: optionalString(formData.get("managerEmployeeId")),
    notes: optionalString(formData.get("notes")),
  });
}

function employeePayload(tenantId: string, values: z.infer<typeof employeeFormSchema>) {
  return {
    tenant_id: idSchema.parse(tenantId),
    employee_code: values.employeeCode.toUpperCase(),
    name_en: values.nameEn,
    name_ar: values.nameAr ?? null,
    position: values.position ?? null,
    email: values.email?.toLowerCase() ?? null,
    phone: values.phone ?? null,
    preferred_locale: values.preferredLocale,
    status: values.status,
    hire_date: values.hireDate ?? null,
    birth_date: values.birthDate ?? null,
    gender: values.gender,
    prior_service_years: values.priorServiceYears,
    is_person_with_disability: values.isPersonWithDisability,
    is_dwarf: values.isDwarf,
    works_hazardous: values.worksHazardous,
    works_unhealthy: values.worksUnhealthy,
    works_remote_location: values.worksRemoteLocation,
    branch_id: values.branchId ?? null,
    team_id: values.teamId ?? null,
    manager_employee_id: values.managerEmployeeId ?? null,
    notes: values.notes ?? null,
  };
}

export async function createEmployee(locale: AppLocale, tenantId: string, formData: FormData) {
  const values = parseEmployeeForm(formData);
  const roleId = idSchema.parse(formData.get("roleId"));
  const supabase = await createSupabaseServerClient();
  const { data: employee, error } = await supabase
    .from("employees")
    .insert(employeePayload(tenantId, values))
    .select("id")
    .single();
  if (error) throw error;

  const { error: roleError } = await supabase.rpc("set_employee_roles", {
    p_employee_id: employee.id,
    p_role_ids: [roleId],
  });
  if (roleError) throw roleError;

  revalidatePath(`/${locale}/employees`);
  revalidatePath(`/${locale}/roles`);
}

export async function createRole(locale: AppLocale, tenantId: string, formData: FormData) {
  const values = z.object({
    name: z.string().trim().min(2).max(60),
    description: z.string().trim().max(300).optional(),
  }).parse({
    name: formData.get("name"),
    description: optionalString(formData.get("description")),
  });
  const normalizedName = values.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (normalizedName.length < 2) throw new Error("Role name must contain letters or numbers");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("roles").insert({
    tenant_id: idSchema.parse(tenantId),
    name: normalizedName,
    description: values.description ?? null,
    is_system: false,
  });
  if (error) throw error;
  revalidatePath(`/${locale}/roles`);
}

export async function updateRoleDetails(locale: AppLocale, tenantId: string, roleId: string, formData: FormData) {
  const values = z.object({
    name: z.string().trim().min(2).max(60),
    description: z.string().trim().max(300).optional(),
  }).parse({
    name: formData.get("name"),
    description: optionalString(formData.get("description")),
  });
  const normalizedName = values.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (normalizedName.length < 2) throw new Error("Role name must contain letters or numbers");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("roles").update({
    name: normalizedName,
    description: values.description ?? null,
  }).eq("tenant_id", idSchema.parse(tenantId)).eq("id", idSchema.parse(roleId)).eq("is_system", false);
  if (error) throw error;
  revalidatePath(`/${locale}/roles`);
  revalidatePath(`/${locale}/roles/${roleId}`);
}

export async function updateRolePermissions(locale: AppLocale, tenantId: string, roleId: string, formData: FormData) {
  idSchema.parse(tenantId);
  const parsedRoleId = idSchema.parse(roleId);
  const permissionKeys = z.array(permissionKeySchema).max(100).parse(
    [...new Set(formData.getAll("permissionKeys").map(String))],
  );
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_role_permissions", {
    p_role_id: parsedRoleId,
    p_permission_keys: permissionKeys,
  });
  if (error) throw error;
  revalidatePath(`/${locale}/roles`);
  revalidatePath(`/${locale}/roles/${roleId}`);
  revalidatePath(`/${locale}/audit`);
}

export async function updateEmployee(locale: AppLocale, tenantId: string, employeeId: string, formData: FormData) {
  const values = parseEmployeeForm(formData);
  const supabase = await createSupabaseServerClient();
  const payload = employeePayload(tenantId, values);
  const { tenant_id: _tenantId, ...updates } = payload;
  void _tenantId;
  const { error } = await supabase.from("employees").update(updates)
    .eq("tenant_id", idSchema.parse(tenantId))
    .eq("id", idSchema.parse(employeeId));
  if (error) throw error;
  revalidatePath(`/${locale}/employees`);
  revalidatePath(`/${locale}/employees/${employeeId}`);
}

export async function archiveEmployee(locale: AppLocale, tenantId: string, employeeId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("employees")
    .update({ status: "terminated" })
    .eq("tenant_id", idSchema.parse(tenantId))
    .eq("id", idSchema.parse(employeeId));
  if (error) throw error;
  revalidatePath(`/${locale}/employees`);
  revalidatePath(`/${locale}/employees/${employeeId}`);
}

export async function updateEmployeeRoles(locale: AppLocale, tenantId: string, employeeId: string, formData: FormData) {
  const parsedTenantId = idSchema.parse(tenantId);
  const parsedEmployeeId = idSchema.parse(employeeId);
  const roleIds = z.array(idSchema).max(20).parse(
    [...new Set(formData.getAll("roleIds").map((value) => String(value)))],
  );
  const supabase = await createSupabaseServerClient();

  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("id")
    .eq("tenant_id", parsedTenantId)
    .eq("id", parsedEmployeeId)
    .maybeSingle();
  if (employeeError) throw employeeError;
  if (!employee) throw new Error("Employee not found in this company");

  const { error } = await supabase.rpc("set_employee_roles", {
    p_employee_id: parsedEmployeeId,
    p_role_ids: roleIds,
  });
  if (error) throw error;

  revalidatePath(`/${locale}/employees`);
  revalidatePath(`/${locale}/employees/${employeeId}`);
  revalidatePath(`/${locale}/roles`);
}

const leaveDayPartSchema = z.enum(["full", "first_half", "second_half", "hours"]);
const leaveTransactionKindSchema = z.enum(["adjustment", "carryover", "settlement", "holiday_credit", "reversal"]);

function refreshLeavePaths(locale: AppLocale) {
  revalidatePath(`/${locale}/leaves`);
  revalidatePath(`/${locale}/dashboard`);
  revalidatePath(`/${locale}/employees`);
}

export async function submitLeaveRequest(locale: AppLocale, tenantId: string, formData: FormData) {
  const values = z.object({
    employeeId: idSchema,
    leaveTypeId: idSchema,
    startDate: dateSchema,
    endDate: dateSchema,
    dayPart: leaveDayPartSchema,
    requestedMinutes: z.coerce.number().int().min(1).max(720).optional(),
    reason: z.string().trim().max(2000).optional(),
    expectedDeliveryDate: dateSchema.optional(),
    actualDeliveryDate: dateSchema.optional(),
  }).parse({
    employeeId: formData.get("employeeId"),
    leaveTypeId: formData.get("leaveTypeId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    dayPart: formData.get("dayPart") || "full",
    requestedMinutes: optionalString(formData.get("requestedMinutes")),
    reason: optionalString(formData.get("reason")),
    expectedDeliveryDate: optionalString(formData.get("expectedDeliveryDate")),
    actualDeliveryDate: optionalString(formData.get("actualDeliveryDate")),
  });
  idSchema.parse(tenantId);

  const document = formData.get("supportingDocument");
  const hasDocument = document instanceof File && document.size > 0;
  if (hasDocument) {
    if (document.size > 10 * 1024 * 1024) throw new Error("Supporting documents must be 10 MB or smaller.");
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(document.type)) {
      throw new Error("Supporting documents must be PDF, JPG, PNG, or WebP.");
    }
  }

  const supabase = await createSupabaseServerClient();
  const { data: requestId, error } = await supabase.rpc("submit_leave_request", {
    p_employee_id: values.employeeId,
    p_leave_type_id: values.leaveTypeId,
    p_start_date: values.startDate,
    p_end_date: values.endDate,
    p_day_part: values.dayPart,
    p_requested_minutes: values.requestedMinutes ?? null,
    p_reason: values.reason ?? "",
    p_has_document: hasDocument,
    p_expected_delivery_date: values.expectedDeliveryDate ?? null,
    p_actual_delivery_date: values.actualDeliveryDate ?? null,
  });
  if (error) throw error;
  const parsedRequestId = idSchema.parse(requestId);

  if (hasDocument) {
    const safeName = document.name.normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
    const objectPath = `${tenantId}/${values.employeeId}/${parsedRequestId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("leave-documents").upload(objectPath, document, {
      contentType: document.type,
      upsert: false,
    });
    if (uploadError) {
      await supabase.rpc("cancel_leave_request", { p_request_id: parsedRequestId, p_reason: "Document upload failed" });
      throw uploadError;
    }
    const { error: attachError } = await supabase.rpc("attach_leave_document", {
      p_request_id: parsedRequestId,
      p_document_path: objectPath,
    });
    if (attachError) {
      await supabase.rpc("cancel_leave_request", { p_request_id: parsedRequestId, p_reason: "Document attachment failed" });
      throw attachError;
    }
  }

  refreshLeavePaths(locale);
}

export async function reviewLeaveRequest(locale: AppLocale, requestId: string, decision: "approved" | "rejected", formData: FormData) {
  const note = z.string().trim().max(2000).optional().parse(optionalString(formData.get("reviewNote")));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("review_leave_request", {
    p_request_id: idSchema.parse(requestId),
    p_decision: z.enum(["approved", "rejected"]).parse(decision),
    p_note: note ?? null,
  });
  if (error) throw error;
  refreshLeavePaths(locale);
}

export async function cancelLeaveRequest(locale: AppLocale, requestId: string, formData: FormData) {
  const reason = z.string().trim().min(2).max(1000).parse(formData.get("cancellationReason"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_leave_request", {
    p_request_id: idSchema.parse(requestId),
    p_reason: reason,
  });
  if (error) throw error;
  refreshLeavePaths(locale);
}

export async function adjustLeaveBalance(locale: AppLocale, formData: FormData) {
  const values = z.object({
    employeeId: idSchema,
    balanceCode: z.string().trim().min(2).max(60).regex(/^[a-z0-9_]+$/),
    leaveYear: z.coerce.number().int().min(2000).max(2200),
    units: z.coerce.number().min(-1000).max(1000).refine((value) => value !== 0),
    kind: leaveTransactionKindSchema,
    reason: z.string().trim().min(2).max(1000),
  }).parse({
    employeeId: formData.get("employeeId"),
    balanceCode: formData.get("balanceCode"),
    leaveYear: formData.get("leaveYear"),
    units: formData.get("units"),
    kind: formData.get("kind") || "adjustment",
    reason: formData.get("reason"),
  });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("adjust_leave_balance", {
    p_employee_id: values.employeeId,
    p_balance_code: values.balanceCode,
    p_leave_year: values.leaveYear,
    p_units: values.units,
    p_reason: values.reason,
    p_kind: values.kind,
  });
  if (error) throw error;
  refreshLeavePaths(locale);
}

export async function createPublicHoliday(locale: AppLocale, tenantId: string, formData: FormData) {
  const values = z.object({
    holidayDate: dateSchema,
    nameEn: z.string().trim().min(2).max(150),
    nameAr: z.string().trim().min(2).max(150),
    religiousScope: z.enum(["all", "muslim", "non_muslim"]),
    sourceReference: z.string().trim().max(500).optional(),
    isPaid: z.boolean(),
  }).parse({
    holidayDate: formData.get("holidayDate"),
    nameEn: formData.get("nameEn"),
    nameAr: formData.get("nameAr"),
    religiousScope: formData.get("religiousScope") || "all",
    sourceReference: optionalString(formData.get("sourceReference")),
    isPaid: formData.get("isPaid") === "on",
  });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("public_holidays").insert({
    tenant_id: idSchema.parse(tenantId),
    holiday_date: values.holidayDate,
    name_en: values.nameEn,
    name_ar: values.nameAr,
    religious_scope: values.religiousScope,
    source_reference: values.sourceReference ?? null,
    is_paid: values.isPaid,
  });
  if (error) throw error;
  refreshLeavePaths(locale);
}

export async function deletePublicHoliday(locale: AppLocale, tenantId: string, holidayId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("public_holidays").delete()
    .eq("tenant_id", idSchema.parse(tenantId)).eq("id", idSchema.parse(holidayId));
  if (error) throw error;
  refreshLeavePaths(locale);
}

export async function updateLeaveType(locale: AppLocale, tenantId: string, leaveTypeId: string, formData: FormData) {
  const values = z.object({
    isActive: z.boolean(),
    requiresDocument: z.boolean(),
    requiresReason: z.boolean(),
    minNoticeDays: z.coerce.number().int().min(0).max(365),
    maxDaysPerRequest: z.coerce.number().positive().max(1000).optional(),
  }).parse({
    isActive: formData.get("isActive") === "on",
    requiresDocument: formData.get("requiresDocument") === "on",
    requiresReason: formData.get("requiresReason") === "on",
    minNoticeDays: formData.get("minNoticeDays") || "0",
    maxDaysPerRequest: optionalString(formData.get("maxDaysPerRequest")),
  });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("leave_types").update({
    is_active: values.isActive,
    requires_document: values.requiresDocument,
    requires_reason: values.requiresReason,
    min_notice_days: values.minNoticeDays,
    max_days_per_request: values.maxDaysPerRequest ?? null,
  }).eq("tenant_id", idSchema.parse(tenantId)).eq("id", idSchema.parse(leaveTypeId));
  if (error) throw error;
  refreshLeavePaths(locale);
}

export async function createShiftTemplate(locale: AppLocale, tenantId: string, formData: FormData) {
  const values = z.object({
    code: codeSchema,
    nameEn: z.string().trim().min(2).max(150),
    nameAr: z.string().trim().max(150).optional(),
    branchId: optionalId,
    startTime: timeSchema,
    endTime: timeSchema,
    endDayOffset: z.coerce.number().int().min(0).max(1),
    breakMinutes: z.coerce.number().int().min(0).max(480),
    colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  }).parse({
    code: formData.get("code"),
    nameEn: formData.get("nameEn"),
    nameAr: optionalString(formData.get("nameAr")),
    branchId: optionalString(formData.get("branchId")),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    endDayOffset: formData.get("endDayOffset") || "0",
    breakMinutes: formData.get("breakMinutes") || "0",
    colorHex: optionalString(formData.get("colorHex")),
  });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("shift_templates").insert({
    tenant_id: idSchema.parse(tenantId),
    branch_id: values.branchId ?? null,
    code: values.code.toUpperCase(),
    name_en: values.nameEn,
    name_ar: values.nameAr ?? null,
    start_time: values.startTime,
    end_time: values.endTime,
    end_day_offset: values.endDayOffset,
    break_minutes: values.breakMinutes,
    color_hex: values.colorHex ?? null,
  });
  if (error) throw error;
  revalidatePath(`/${locale}/shifts`);
}

export async function toggleShiftTemplate(locale: AppLocale, tenantId: string, shiftId: string, nextActive: boolean) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("shift_templates").update({ is_active: nextActive })
    .eq("tenant_id", idSchema.parse(tenantId)).eq("id", idSchema.parse(shiftId));
  if (error) throw error;
  revalidatePath(`/${locale}/shifts`);
}

export async function createWeeklySchedule(locale: AppLocale, tenantId: string, formData: FormData) {
  const values = z.object({
    branchId: z.string().uuid(),
    weekStart: dateSchema,
    visibility: z.enum(["self", "team", "branch", "all"]),
    notes: z.string().trim().max(2000).optional(),
  }).parse({
    branchId: formData.get("branchId"),
    weekStart: formData.get("weekStart"),
    visibility: formData.get("visibility") || "self",
    notes: optionalString(formData.get("notes")),
  });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("weekly_schedules").insert({
    tenant_id: idSchema.parse(tenantId),
    branch_id: values.branchId,
    week_start: values.weekStart,
    visibility: values.visibility,
    notes: values.notes ?? null,
  }).select("id").single();
  if (error) throw error;
  redirect(`/${locale}/schedules/${data.id}`);
}

export async function addScheduleEntry(locale: AppLocale, tenantId: string, scheduleId: string, scheduledBranchId: string, formData: FormData) {
  const values = z.object({
    employeeId: z.string().uuid(),
    workDate: dateSchema,
    segmentNo: z.coerce.number().int().min(1).max(10),
    entryType: z.enum(["shift", "off", "leave", "training", "assignment"]),
    shiftTemplateId: optionalId,
    customStartTime: timeSchema.optional(),
    customEndTime: timeSchema.optional(),
    endDayOffset: z.coerce.number().int().min(0).max(1),
    breakMinutes: z.coerce.number().int().min(0).max(480),
    positionLabel: z.string().trim().max(150).optional(),
    notes: z.string().trim().max(1000).optional(),
  }).superRefine((value, ctx) => {
    if (value.entryType === "shift") {
      const usesTemplate = Boolean(value.shiftTemplateId);
      const usesCustom = Boolean(value.customStartTime && value.customEndTime);
      if (usesTemplate === usesCustom) {
        ctx.addIssue({ code: "custom", message: "Choose either a shift template or custom start/end times." });
      }
    }
  }).parse({
    employeeId: formData.get("employeeId"),
    workDate: formData.get("workDate"),
    segmentNo: formData.get("segmentNo") || "1",
    entryType: formData.get("entryType") || "shift",
    shiftTemplateId: optionalString(formData.get("shiftTemplateId")),
    customStartTime: optionalString(formData.get("customStartTime")),
    customEndTime: optionalString(formData.get("customEndTime")),
    endDayOffset: formData.get("endDayOffset") || "0",
    breakMinutes: formData.get("breakMinutes") || "0",
    positionLabel: optionalString(formData.get("positionLabel")),
    notes: optionalString(formData.get("notes")),
  });

  const isShift = values.entryType === "shift";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("schedule_entries").upsert({
    tenant_id: idSchema.parse(tenantId),
    schedule_id: idSchema.parse(scheduleId),
    employee_id: values.employeeId,
    scheduled_branch_id: idSchema.parse(scheduledBranchId),
    work_date: values.workDate,
    segment_no: values.segmentNo,
    entry_type: values.entryType,
    shift_template_id: isShift ? values.shiftTemplateId ?? null : null,
    custom_start_time: isShift ? values.customStartTime ?? null : null,
    custom_end_time: isShift ? values.customEndTime ?? null : null,
    end_day_offset: isShift ? values.endDayOffset : 0,
    break_minutes: isShift ? values.breakMinutes : 0,
    position_label: values.positionLabel ?? null,
    notes: values.notes ?? null,
  }, { onConflict: "schedule_id,employee_id,work_date,segment_no" });
  if (error) throw error;
  revalidatePath(`/${locale}/schedules/${scheduleId}`);
}

export async function bulkAssignScheduleEntries(locale: AppLocale, tenantId: string, scheduleId: string, formData: FormData) {
  const values = z.object({
    employeeIds: z.array(z.string().uuid()).min(1, "Select at least one employee.").max(100),
    workDates: z.array(dateSchema).min(1, "Select at least one work day.").max(7),
    entryType: z.enum(["shift", "off", "leave", "training", "assignment"]),
    shiftTemplateId: optionalId,
    customStartTime: timeSchema.optional(),
    customEndTime: timeSchema.optional(),
    breakMinutes: z.coerce.number().int().min(0).max(480),
    positionLabel: z.string().trim().max(150).optional(),
    notes: z.string().trim().max(1000).optional(),
  }).superRefine((value, ctx) => {
    if (value.entryType !== "shift") return;
    const usesTemplate = Boolean(value.shiftTemplateId);
    const usesCustom = Boolean(value.customStartTime && value.customEndTime);
    if (usesTemplate === usesCustom) {
      ctx.addIssue({ code: "custom", message: "Choose a shift template or enter exact start and end times." });
    }
  }).parse({
    employeeIds: [...new Set(formData.getAll("employeeIds").map(String))],
    workDates: [...new Set(formData.getAll("workDates").map(String))],
    entryType: formData.get("entryType") || "shift",
    shiftTemplateId: optionalString(formData.get("shiftTemplateId")),
    customStartTime: optionalString(formData.get("customStartTime")),
    customEndTime: optionalString(formData.get("customEndTime")),
    breakMinutes: formData.get("breakMinutes") || "0",
    positionLabel: optionalString(formData.get("positionLabel")),
    notes: optionalString(formData.get("notes")),
  });

  idSchema.parse(tenantId);
  const usesCustomTimes = values.entryType === "shift" && !values.shiftTemplateId;
  const endsNextDay = usesCustomTimes
    && Boolean(values.customStartTime && values.customEndTime)
    && values.customEndTime! <= values.customStartTime!;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("bulk_assign_schedule_entries", {
    p_schedule_id: idSchema.parse(scheduleId),
    p_employee_ids: values.employeeIds,
    p_work_dates: values.workDates,
    p_entry_type: values.entryType,
    p_shift_template_id: values.entryType === "shift" ? values.shiftTemplateId ?? null : null,
    p_custom_start_time: usesCustomTimes ? values.customStartTime ?? null : null,
    p_custom_end_time: usesCustomTimes ? values.customEndTime ?? null : null,
    p_end_day_offset: endsNextDay ? 1 : 0,
    p_break_minutes: values.entryType === "shift" ? values.breakMinutes : 0,
    p_position_label: values.positionLabel ?? null,
    p_notes: values.notes ?? null,
  });
  if (error) throw error;
  revalidatePath(`/${locale}/schedules/${scheduleId}`);
}

export async function deleteScheduleEntry(locale: AppLocale, tenantId: string, scheduleId: string, entryId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("schedule_entries").delete()
    .eq("tenant_id", idSchema.parse(tenantId))
    .eq("schedule_id", idSchema.parse(scheduleId))
    .eq("id", idSchema.parse(entryId));
  if (error) throw error;
  revalidatePath(`/${locale}/schedules/${scheduleId}`);
}

export async function transitionSchedule(locale: AppLocale, scheduleId: string, targetStatus: "draft" | "published" | "locked" | "archived", formData?: FormData) {
  const reason = optionalString(formData?.get("reason") ?? null);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_weekly_schedule_status", {
    p_schedule_id: idSchema.parse(scheduleId),
    p_target_status: targetStatus,
    p_reason: reason ?? null,
  });
  if (error) throw error;
  revalidatePath(`/${locale}/schedules`);
  revalidatePath(`/${locale}/schedules/${scheduleId}`);
}

export async function copyWeeklySchedule(locale: AppLocale, sourceScheduleId: string, formData: FormData) {
  const targetWeekStart = dateSchema.parse(formData.get("targetWeekStart"));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("copy_weekly_schedule", {
    p_source_schedule_id: idSchema.parse(sourceScheduleId),
    p_target_week_start: targetWeekStart,
  });
  if (error) throw error;
  redirect(`/${locale}/schedules/${data}`);
}

export async function recordManualAttendancePunch(locale: AppLocale, tenantId: string, formData: FormData) {
  const values = z.object({
    employeeId: z.string().uuid(),
    branchId: optionalId,
    workDate: dateSchema,
    punchType: z.enum(["check_in", "check_out"]),
    occurredAt: z.string().datetime({ offset: true }),
    notes: z.string().trim().max(1000).optional(),
  }).parse({
    employeeId: formData.get("employeeId"),
    branchId: optionalString(formData.get("branchId")),
    workDate: formData.get("workDate"),
    punchType: formData.get("punchType"),
    occurredAt: formData.get("occurredAt"),
    notes: optionalString(formData.get("notes")),
  });
  idSchema.parse(tenantId);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_attendance_punch", {
    p_employee_id: values.employeeId,
    p_punch_type: values.punchType,
    p_occurred_at: values.occurredAt,
    p_source: "manual",
    p_work_date: values.workDate,
    p_branch_id: values.branchId ?? null,
    p_notes: values.notes ?? null,
  });
  if (error) throw error;
  revalidatePath(`/${locale}/attendance`);
}

export async function refreshAttendancePeriod(locale: AppLocale, tenantId: string, formData: FormData) {
  const values = z.object({ dateFrom: dateSchema, dateTo: dateSchema }).refine((value) => value.dateTo >= value.dateFrom, {
    message: "End date must be on or after start date.",
  }).parse({ dateFrom: formData.get("dateFrom"), dateTo: formData.get("dateTo") });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("refresh_attendance_period", {
    p_tenant_id: idSchema.parse(tenantId), p_date_from: values.dateFrom, p_date_to: values.dateTo,
  });
  if (error) throw error;
  revalidatePath(`/${locale}/attendance`);
}

export async function reviewAttendancePunch(locale: AppLocale, punchId: string, decision: "valid" | "rejected", formData: FormData) {
  const noteValue = optionalString(formData.get("note"));
  const note = (decision === "rejected" ? z.string().trim().min(3).max(1000) : z.string().trim().max(1000).optional()).parse(noteValue);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("review_attendance_punch", {
    p_punch_id: idSchema.parse(punchId), p_decision: decision, p_note: note ?? null,
  });
  if (error) throw error;
  revalidatePath(`/${locale}/attendance`);
}
