"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppLocale } from "@/lib/i18n";
import { configuredWeekStart } from "@/lib/scheduling";
import { parseAttendanceCsv, parseAttendanceTable, type AttendanceColumnOverrides, type AttendanceImportCell } from "@/lib/attendance-import";

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

const requestDecisionSchema = z.enum(["approved", "rejected"]);
const approverKindSchema = z.enum(["manager", "owner", "hr", "role"]);
const approvalModeSchema = z.enum(["any", "all", "count"]);

function refreshRequestPaths(locale: AppLocale) {
  revalidatePath(`/${locale}/requests`);
  revalidatePath(`/${locale}/requests/workflows`);
  revalidatePath(`/${locale}/leaves`);
  revalidatePath(`/${locale}/leaves/settings`);
  revalidatePath(`/${locale}/dashboard`);
}

export async function submitHrRequest(locale: AppLocale, tenantId: string, formData: FormData) {
  const values = z.object({
    employeeId: idSchema,
    requestTypeId: idSchema,
    title: z.string().trim().max(180).optional(),
    reason: z.string().trim().max(3000).optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    startTime: timeSchema.optional(),
    endTime: timeSchema.optional(),
    requestedMinutes: z.coerce.number().int().min(1).max(1440).optional(),
    branchId: optionalId,
  }).parse({
    employeeId: formData.get("employeeId"),
    requestTypeId: formData.get("requestTypeId"),
    title: optionalString(formData.get("title")),
    reason: optionalString(formData.get("reason")),
    startDate: optionalString(formData.get("startDate")),
    endDate: optionalString(formData.get("endDate")),
    startTime: optionalString(formData.get("startTime")),
    endTime: optionalString(formData.get("endTime")),
    requestedMinutes: optionalString(formData.get("requestedMinutes")),
    branchId: optionalString(formData.get("branchId")),
  });
  const parsedTenantId = idSchema.parse(tenantId);
  const document = formData.get("supportingDocument");
  const hasDocument = document instanceof File && document.size > 0;
  if (hasDocument) {
    if (document.size > 10 * 1024 * 1024) throw new Error("Supporting documents must be 10 MB or smaller.");
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(document.type)) {
      throw new Error("Supporting documents must be PDF, JPG, PNG, or WebP.");
    }
  }

  const supabase = await createSupabaseServerClient();
  const { data: requestId, error } = await supabase.rpc("submit_hr_request", {
    p_employee_id: values.employeeId,
    p_request_type_id: values.requestTypeId,
    p_title: values.title ?? null,
    p_reason: values.reason ?? null,
    p_start_date: values.startDate ?? null,
    p_end_date: values.endDate ?? null,
    p_start_time: values.startTime ?? null,
    p_end_time: values.endTime ?? null,
    p_requested_minutes: values.requestedMinutes ?? null,
    p_payload: values.branchId ? { branch_id: values.branchId } : {},
    p_has_attachment: hasDocument,
  });
  if (error) throw error;
  const parsedRequestId = idSchema.parse(requestId);

  if (hasDocument) {
    const safeName = document.name.normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
    const objectPath = `${parsedTenantId}/${values.employeeId}/${parsedRequestId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("request-documents").upload(objectPath, document, {
      contentType: document.type,
      upsert: false,
    });
    if (uploadError) {
      await supabase.rpc("cancel_hr_request", { p_request_id: parsedRequestId, p_reason: "Supporting document upload failed" });
      throw uploadError;
    }
    const { error: attachError } = await supabase.rpc("attach_request_document", {
      p_request_id: parsedRequestId,
      p_object_path: objectPath,
      p_file_name: document.name.slice(0, 250),
      p_mime_type: document.type,
      p_size_bytes: document.size,
    });
    if (attachError) {
      await supabase.storage.from("request-documents").remove([objectPath]);
      await supabase.rpc("cancel_hr_request", { p_request_id: parsedRequestId, p_reason: "Supporting document attachment failed" });
      throw attachError;
    }
  }
  refreshRequestPaths(locale);
}

export async function reviewHrRequest(locale: AppLocale, requestId: string, decision: "approved" | "rejected", formData: FormData) {
  const note = z.string().trim().max(2000).optional().parse(optionalString(formData.get("reviewNote")));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("review_hr_request", {
    p_request_id: idSchema.parse(requestId),
    p_decision: requestDecisionSchema.parse(decision),
    p_note: note ?? null,
  });
  if (error) throw error;
  refreshRequestPaths(locale);
}

export async function cancelHrRequest(locale: AppLocale, requestId: string, formData: FormData) {
  const reason = z.string().trim().min(2).max(1000).parse(formData.get("cancellationReason"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_hr_request", {
    p_request_id: idSchema.parse(requestId),
    p_reason: reason,
  });
  if (error) throw error;
  refreshRequestPaths(locale);
}

export async function cloneRequestWorkflow(locale: AppLocale, workflowId: string, formData: FormData) {
  const values = z.object({
    nameEn: z.string().trim().min(2).max(150),
    nameAr: z.string().trim().min(2).max(150),
  }).parse({ nameEn: formData.get("nameEn"), nameAr: formData.get("nameAr") });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("clone_request_workflow", {
    p_workflow_id: idSchema.parse(workflowId),
    p_name_en: values.nameEn,
    p_name_ar: values.nameAr,
  });
  if (error) throw error;
  refreshRequestPaths(locale);
}

export async function addRequestWorkflowStep(locale: AppLocale, tenantId: string, workflowId: string, formData: FormData) {
  const values = z.object({
    stepOrder: z.coerce.number().int().min(1).max(50),
    nameEn: z.string().trim().min(2).max(150),
    nameAr: z.string().trim().min(2).max(150),
    approverKind: approverKindSchema,
    roleId: optionalId,
    approvalMode: approvalModeSchema,
    approvalsRequired: z.coerce.number().int().min(1).max(50),
    slaHours: z.coerce.number().int().min(1).max(8760).optional(),
  }).parse({
    stepOrder: formData.get("stepOrder"),
    nameEn: formData.get("nameEn"),
    nameAr: formData.get("nameAr"),
    approverKind: formData.get("approverKind"),
    roleId: optionalString(formData.get("roleId")),
    approvalMode: formData.get("approvalMode") || "any",
    approvalsRequired: formData.get("approvalsRequired") || "1",
    slaHours: optionalString(formData.get("slaHours")),
  });
  if (values.approverKind === "role" && !values.roleId) throw new Error("Choose a role for a role-based approval step.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("approval_workflow_steps").insert({
    tenant_id: idSchema.parse(tenantId),
    workflow_id: idSchema.parse(workflowId),
    step_order: values.stepOrder,
    name_en: values.nameEn,
    name_ar: values.nameAr,
    approver_kind: values.approverKind,
    role_id: values.approverKind === "role" ? values.roleId : null,
    approval_mode: values.approvalMode,
    approvals_required: values.approvalsRequired,
    sla_hours: values.slaHours ?? null,
  });
  if (error) throw error;
  refreshRequestPaths(locale);
}

export async function updateRequestWorkflowStep(locale: AppLocale, tenantId: string, stepId: string, formData: FormData) {
  const values = z.object({
    stepOrder: z.coerce.number().int().min(1).max(50),
    nameEn: z.string().trim().min(2).max(150),
    nameAr: z.string().trim().min(2).max(150),
    approverKind: approverKindSchema,
    roleId: optionalId,
    approvalMode: approvalModeSchema,
    approvalsRequired: z.coerce.number().int().min(1).max(50),
    slaHours: z.coerce.number().int().min(1).max(8760).optional(),
  }).parse({
    stepOrder: formData.get("stepOrder"), nameEn: formData.get("nameEn"), nameAr: formData.get("nameAr"),
    approverKind: formData.get("approverKind"), roleId: optionalString(formData.get("roleId")),
    approvalMode: formData.get("approvalMode") || "any", approvalsRequired: formData.get("approvalsRequired") || "1",
    slaHours: optionalString(formData.get("slaHours")),
  });
  if (values.approverKind === "role" && !values.roleId) throw new Error("Choose a role for a role-based approval step.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("approval_workflow_steps").update({
    step_order: values.stepOrder, name_en: values.nameEn, name_ar: values.nameAr,
    approver_kind: values.approverKind, role_id: values.approverKind === "role" ? values.roleId : null,
    approval_mode: values.approvalMode, approvals_required: values.approvalsRequired, sla_hours: values.slaHours ?? null,
  }).eq("tenant_id", idSchema.parse(tenantId)).eq("id", idSchema.parse(stepId));
  if (error) throw error;
  refreshRequestPaths(locale);
}

export async function deleteRequestWorkflowStep(locale: AppLocale, tenantId: string, stepId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("approval_workflow_steps").delete()
    .eq("tenant_id", idSchema.parse(tenantId)).eq("id", idSchema.parse(stepId));
  if (error) throw error;
  refreshRequestPaths(locale);
}

export async function activateRequestWorkflow(locale: AppLocale, workflowId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("activate_request_workflow", { p_workflow_id: idSchema.parse(workflowId) });
  if (error) throw error;
  refreshRequestPaths(locale);
}

export async function markNotificationRead(locale: AppLocale, notificationId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("mark_notification_read", { p_notification_id: idSchema.parse(notificationId) });
  if (error) throw error;
  revalidatePath(`/${locale}`, "layout");
}

export async function markAllNotificationsRead(locale: AppLocale, tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("mark_all_notifications_read", { p_tenant_id: idSchema.parse(tenantId) });
  if (error) throw error;
  revalidatePath(`/${locale}`, "layout");
}

const leaveDayPartSchema = z.enum(["full", "first_half", "second_half", "hours"]);
const leaveTransactionKindSchema = z.enum(["adjustment", "carryover", "settlement", "holiday_credit", "reversal"]);

function refreshLeavePaths(locale: AppLocale) {
  revalidatePath(`/${locale}/leaves`);
  revalidatePath(`/${locale}/leaves/settings`);
  revalidatePath(`/${locale}/requests/workflows`);
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

const salaryBasisSchema = z.enum(["monthly", "daily", "hourly", "mixed", "commission"]);
const payrollComponentKindSchema = z.enum(["earning", "deduction"]);
const payrollStatusSchema = z.enum(["reviewed", "approved", "locked", "published", "cancelled"]);

function refreshPayrollPaths(locale: AppLocale, periodId?: string, resultId?: string) {
  revalidatePath(`/${locale}/payroll`);
  if (periodId) revalidatePath(`/${locale}/payroll/${periodId}`);
  if (resultId) revalidatePath(`/${locale}/payslips/${resultId}`);
  revalidatePath(`/${locale}/dashboard`);
}

export async function updatePayrollSettings(locale: AppLocale, tenantId: string, formData: FormData) {
  const values = z.object({
    currencyCode: z.string().trim().length(3).transform((value) => value.toUpperCase()),
    standardMonthlyDays: z.coerce.number().positive().max(31),
    standardDailyHours: z.coerce.number().positive().max(24),
    overtimeMultiplier: z.coerce.number().min(0).max(10),
    lateDeductionMultiplier: z.coerce.number().min(0).max(10),
    absenceDeductionMultiplier: z.coerce.number().min(0).max(10),
    roundToDigits: z.coerce.number().int().min(0).max(4),
    taxEnabled: z.boolean(),
    insuranceEnabled: z.boolean(),
  }).parse({
    currencyCode: formData.get("currencyCode"), standardMonthlyDays: formData.get("standardMonthlyDays"), standardDailyHours: formData.get("standardDailyHours"),
    overtimeMultiplier: formData.get("overtimeMultiplier"), lateDeductionMultiplier: formData.get("lateDeductionMultiplier"), absenceDeductionMultiplier: formData.get("absenceDeductionMultiplier"),
    roundToDigits: formData.get("roundToDigits"), taxEnabled: formData.get("taxEnabled") === "on", insuranceEnabled: formData.get("insuranceEnabled") === "on",
  });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("payroll_settings").update({
    currency_code: values.currencyCode, standard_monthly_days: values.standardMonthlyDays, standard_daily_hours: values.standardDailyHours,
    overtime_multiplier: values.overtimeMultiplier, late_deduction_multiplier: values.lateDeductionMultiplier, absence_deduction_multiplier: values.absenceDeductionMultiplier,
    round_to_digits: values.roundToDigits, tax_enabled: values.taxEnabled, insurance_enabled: values.insuranceEnabled,
  }).eq("tenant_id", idSchema.parse(tenantId));
  if (error) throw error;
  refreshPayrollPaths(locale);
}

export async function saveEmployeeCompensation(locale: AppLocale, employeeId: string, formData: FormData) {
  const values = z.object({
    salaryBasis: salaryBasisSchema,
    baseSalary: z.coerce.number().min(0).max(1_000_000_000),
    dailyRate: z.coerce.number().min(0).max(1_000_000_000).optional(),
    hourlyRate: z.coerce.number().min(0).max(1_000_000_000).optional(),
    fixedAllowances: z.coerce.number().min(0).max(1_000_000_000),
    currencyCode: z.string().trim().length(3).transform((value) => value.toUpperCase()),
    effectiveFrom: dateSchema,
    notes: z.string().trim().max(2000).optional(),
  }).parse({
    salaryBasis: formData.get("salaryBasis"), baseSalary: formData.get("baseSalary") || "0", dailyRate: optionalString(formData.get("dailyRate")), hourlyRate: optionalString(formData.get("hourlyRate")),
    fixedAllowances: formData.get("fixedAllowances") || "0", currencyCode: formData.get("currencyCode"), effectiveFrom: formData.get("effectiveFrom"), notes: optionalString(formData.get("notes")),
  });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("upsert_employee_compensation", {
    p_employee_id: idSchema.parse(employeeId), p_salary_basis: values.salaryBasis, p_base_salary: values.baseSalary,
    p_daily_rate: values.dailyRate ?? null, p_hourly_rate: values.hourlyRate ?? null, p_fixed_allowances: values.fixedAllowances,
    p_currency_code: values.currencyCode, p_effective_from: values.effectiveFrom, p_notes: values.notes ?? "",
  });
  if (error) throw error;
  refreshPayrollPaths(locale);
  revalidatePath(`/${locale}/employees/${employeeId}`);
}

export async function createPayrollPeriod(locale: AppLocale, tenantId: string, formData: FormData) {
  const values = z.object({ code: codeSchema, name: z.string().trim().min(2).max(150), startDate: dateSchema, endDate: dateSchema, payDate: dateSchema.optional() }).parse({
    code: formData.get("code"), name: formData.get("name"), startDate: formData.get("startDate"), endDate: formData.get("endDate"), payDate: optionalString(formData.get("payDate")),
  });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_payroll_period", { p_tenant_id: idSchema.parse(tenantId), p_code: values.code, p_name: values.name, p_start: values.startDate, p_end: values.endDate, p_pay_date: values.payDate ?? null });
  if (error) throw error;
  refreshPayrollPaths(locale, idSchema.parse(data));
}

export async function calculatePayrollPeriod(locale: AppLocale, periodId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("calculate_payroll_period", { p_period_id: idSchema.parse(periodId) });
  if (error) throw error;
  refreshPayrollPaths(locale, periodId);
}

export async function transitionPayrollPeriod(locale: AppLocale, periodId: string, target: "reviewed" | "approved" | "locked" | "published" | "cancelled", formData: FormData) {
  const note = z.string().trim().max(2000).optional().parse(optionalString(formData.get("transitionNote")));
  const parsedTarget = payrollStatusSchema.parse(target);
  if (parsedTarget === "cancelled" && !note) throw new Error("A cancellation reason is required.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("transition_payroll_period", { p_period_id: idSchema.parse(periodId), p_target: parsedTarget, p_note: note ?? "" });
  if (error) throw error;
  refreshPayrollPaths(locale, periodId);
}

export async function addPayrollAdjustment(locale: AppLocale, periodId: string, resultId: string, formData: FormData) {
  const values = z.object({ kind: payrollComponentKindSchema, code: z.string().trim().min(2).max(60).regex(/^[a-z0-9_]+$/), nameEn: z.string().trim().min(2).max(150), nameAr: z.string().trim().min(2).max(150), amount: z.coerce.number().positive().max(1_000_000_000), reason: z.string().trim().min(2).max(2000) }).parse({
    kind: formData.get("kind"), code: formData.get("code"), nameEn: formData.get("nameEn"), nameAr: formData.get("nameAr"), amount: formData.get("amount"), reason: formData.get("reason"),
  });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("add_payroll_adjustment", { p_result_id: idSchema.parse(resultId), p_kind: values.kind, p_code: values.code, p_name_en: values.nameEn, p_name_ar: values.nameAr, p_amount: values.amount, p_reason: values.reason });
  if (error) throw error;
  refreshPayrollPaths(locale, periodId, resultId);
}

export async function deletePayrollAdjustment(locale: AppLocale, periodId: string, resultId: string, componentId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_payroll_adjustment", { p_component_id: idSchema.parse(componentId) });
  if (error) throw error;
  refreshPayrollPaths(locale, periodId, resultId);
}

export async function acknowledgePayslip(locale: AppLocale, resultId: string, payslipId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("acknowledge_payslip", { p_payslip_id: idSchema.parse(payslipId) });
  if (error) throw error;
  refreshPayrollPaths(locale, undefined, resultId);
}

const loanPaymentMethodSchema = z.enum(["cash", "bank_transfer", "settlement", "adjustment"]);
const employeeLoanStatusSchema = z.enum(["active", "paused", "written_off"]);
const performanceScopeSchema = z.enum(["branch", "team", "employee"]);
const bonusBasisSchema = z.enum(["fixed_amount", "salary_percentage", "sales_percentage"]);

function refreshLoanPaths(locale: AppLocale, loanId?: string) {
  revalidatePath(`/${locale}/loans`);
  if (loanId) revalidatePath(`/${locale}/loans/${loanId}`);
  revalidatePath(`/${locale}/payroll`);
  revalidatePath(`/${locale}/dashboard`);
}

function refreshPerformancePaths(locale: AppLocale) {
  revalidatePath(`/${locale}/performance`);
  revalidatePath(`/${locale}/payroll`);
  revalidatePath(`/${locale}/dashboard`);
}

export async function submitLoanRequest(locale: AppLocale, defaultEmployeeId: string, formData: FormData) {
  const values = z.object({ employeeId: idSchema, amount: z.coerce.number().positive().max(1_000_000_000), installments: z.coerce.number().int().min(1).max(120), startMonth: dateSchema, purpose: z.string().trim().min(3).max(2000) }).parse({
    employeeId: optionalString(formData.get("employeeId")) ?? defaultEmployeeId, amount: formData.get("amount"), installments: formData.get("installments"), startMonth: formData.get("startMonth"), purpose: formData.get("purpose"),
  });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("submit_loan_request", { p_employee_id: values.employeeId, p_amount: values.amount, p_installments: values.installments, p_start_month: values.startMonth, p_purpose: values.purpose });
  if (error) throw error;
  refreshLoanPaths(locale);
}

export async function cancelLoanRequest(locale: AppLocale, requestId: string, formData: FormData) {
  const reason = z.string().trim().max(1000).optional().parse(optionalString(formData.get("reason")));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_loan_request", { p_request_id: idSchema.parse(requestId), p_reason: reason ?? "" });
  if (error) throw error;
  refreshLoanPaths(locale);
}

export async function reviewLoanRequest(locale: AppLocale, requestId: string, approve: boolean, formData: FormData) {
  const values = z.object({ amount: z.coerce.number().positive().max(1_000_000_000).optional(), installments: z.coerce.number().int().min(1).max(120).optional(), startMonth: dateSchema.optional(), note: z.string().trim().max(2000).optional() }).parse({
    amount: optionalString(formData.get("approvedAmount")), installments: optionalString(formData.get("approvedInstallments")), startMonth: optionalString(formData.get("approvedStartMonth")), note: optionalString(formData.get("decisionNote")),
  });
  if (approve && (!values.amount || !values.installments || !values.startMonth)) throw new Error("Approved amount, installment count, and start month are required.");
  if (!approve && (!values.note || values.note.length < 2)) throw new Error("A rejection reason is required.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("review_loan_request", { p_request_id: idSchema.parse(requestId), p_approve: approve, p_amount: values.amount ?? 0, p_installments: values.installments ?? 1, p_start_month: values.startMonth ?? new Date().toISOString().slice(0, 8) + "01", p_note: values.note ?? "" });
  if (error) throw error;
  refreshLoanPaths(locale, data ? idSchema.parse(data) : undefined);
}

export async function recordLoanPayment(locale: AppLocale, loanId: string, formData: FormData) {
  const values = z.object({ amount: z.coerce.number().positive().max(1_000_000_000), paymentDate: dateSchema, method: loanPaymentMethodSchema, reference: z.string().trim().max(150).optional(), notes: z.string().trim().max(2000).optional() }).parse({
    amount: formData.get("amount"), paymentDate: formData.get("paymentDate"), method: formData.get("method"), reference: optionalString(formData.get("reference")), notes: optionalString(formData.get("notes")),
  });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_loan_payment", { p_loan_id: idSchema.parse(loanId), p_amount: values.amount, p_payment_date: values.paymentDate, p_method: values.method, p_reference: values.reference ?? "", p_notes: values.notes ?? "" });
  if (error) throw error;
  refreshLoanPaths(locale, loanId);
}

export async function rescheduleLoanInstallment(locale: AppLocale, loanId: string, installmentId: string, formData: FormData) {
  const values = z.object({ dueDate: dateSchema, reason: z.string().trim().min(2).max(1000) }).parse({ dueDate: formData.get("dueDate"), reason: formData.get("reason") });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("reschedule_loan_installment", { p_installment_id: idSchema.parse(installmentId), p_due_date: values.dueDate, p_reason: values.reason });
  if (error) throw error;
  refreshLoanPaths(locale, loanId);
}

export async function setEmployeeLoanStatus(locale: AppLocale, loanId: string, nextStatus: "active" | "paused" | "written_off", formData: FormData) {
  const status = employeeLoanStatusSchema.parse(nextStatus);
  const note = z.string().trim().max(2000).optional().parse(optionalString(formData.get("statusNote")));
  if (status === "written_off" && (!note || note.length < 2)) throw new Error("A write-off reason is required.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_employee_loan_status", { p_loan_id: idSchema.parse(loanId), p_status: status, p_note: note ?? "" });
  if (error) throw error;
  refreshLoanPaths(locale, loanId);
}

export async function recordSalesEntry(locale: AppLocale, tenantId: string, formData: FormData) {
  const values = z.object({ businessDate: dateSchema, branchId: idSchema, employeeId: optionalId, amount: z.coerce.number().min(0).max(1_000_000_000), currencyCode: z.string().trim().length(3).transform((value) => value.toUpperCase()), reference: z.string().trim().max(150).optional(), notes: z.string().trim().max(2000).optional() }).parse({
    businessDate: formData.get("businessDate"), branchId: formData.get("branchId"), employeeId: optionalString(formData.get("employeeId")), amount: formData.get("amount"), currencyCode: formData.get("currencyCode"), reference: optionalString(formData.get("reference")), notes: optionalString(formData.get("notes")),
  });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_sales_entry", { p_tenant_id: idSchema.parse(tenantId), p_business_date: values.businessDate, p_branch_id: values.branchId, p_employee_id: values.employeeId ?? null, p_amount: values.amount, p_currency: values.currencyCode, p_reference: values.reference ?? "", p_notes: values.notes ?? "" });
  if (error) throw error;
  refreshPerformancePaths(locale);
}

export async function reviewSalesEntry(locale: AppLocale, entryId: string, approve: boolean, formData: FormData) {
  const note = z.string().trim().max(1000).optional().parse(optionalString(formData.get("reviewNote")));
  if (!approve && (!note || note.length < 2)) throw new Error("A rejection reason is required.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("review_sales_entry", { p_entry_id: idSchema.parse(entryId), p_approve: approve, p_note: note ?? "" });
  if (error) throw error;
  refreshPerformancePaths(locale);
}

export async function createBonusPolicy(locale: AppLocale, tenantId: string, formData: FormData) {
  const values = z.object({ code: codeSchema, nameEn: z.string().trim().min(2).max(150), nameAr: z.string().trim().max(150).optional(), basis: bonusBasisSchema, thresholdOne: z.coerce.number().min(0).max(10000), valueOne: z.coerce.number().min(0).max(1_000_000), thresholdTwo: z.coerce.number().min(0).max(10000), valueTwo: z.coerce.number().min(0).max(1_000_000), thresholdThree: z.coerce.number().min(0).max(10000).optional(), valueThree: z.coerce.number().min(0).max(1_000_000).optional(), effectiveFrom: dateSchema, effectiveTo: dateSchema.optional() }).parse({
    code: formData.get("code"), nameEn: formData.get("nameEn"), nameAr: optionalString(formData.get("nameAr")), basis: formData.get("basis"), thresholdOne: formData.get("thresholdOne"), valueOne: formData.get("valueOne"), thresholdTwo: formData.get("thresholdTwo"), valueTwo: formData.get("valueTwo"), thresholdThree: optionalString(formData.get("thresholdThree")), valueThree: optionalString(formData.get("valueThree")), effectiveFrom: formData.get("effectiveFrom"), effectiveTo: optionalString(formData.get("effectiveTo")),
  });
  const tiers = [{ min_percentage: values.thresholdOne, value: values.valueOne }, { min_percentage: values.thresholdTwo, value: values.valueTwo }];
  if (values.thresholdThree !== undefined && values.valueThree !== undefined) tiers.push({ min_percentage: values.thresholdThree, value: values.valueThree });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_bonus_policy", { p_tenant_id: idSchema.parse(tenantId), p_code: values.code, p_name_en: values.nameEn, p_name_ar: values.nameAr ?? "", p_basis: values.basis, p_tiers: tiers, p_effective_from: values.effectiveFrom, p_effective_to: values.effectiveTo ?? null });
  if (error) throw error;
  refreshPerformancePaths(locale);
}

export async function createSalesTarget(locale: AppLocale, tenantId: string, formData: FormData) {
  const values = z.object({ code: codeSchema, name: z.string().trim().min(2).max(150), startDate: dateSchema, endDate: dateSchema, scope: performanceScopeSchema, scopeId: idSchema, targetAmount: z.coerce.number().positive().max(1_000_000_000), currencyCode: z.string().trim().length(3).transform((value) => value.toUpperCase()), policyId: idSchema }).refine((value) => value.endDate >= value.startDate, { message: "Target end must be on or after the start." }).parse({
    code: formData.get("code"), name: formData.get("name"), startDate: formData.get("startDate"), endDate: formData.get("endDate"), scope: formData.get("scope"), scopeId: formData.get("scopeId"), targetAmount: formData.get("targetAmount"), currencyCode: formData.get("currencyCode"), policyId: formData.get("policyId"),
  });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_sales_target", { p_tenant_id: idSchema.parse(tenantId), p_code: values.code, p_name: values.name, p_start: values.startDate, p_end: values.endDate, p_scope: values.scope, p_scope_id: values.scopeId, p_amount: values.targetAmount, p_currency: values.currencyCode, p_policy_id: values.policyId });
  if (error) throw error;
  refreshPerformancePaths(locale);
}

export async function calculateBonusTarget(locale: AppLocale, targetId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("calculate_bonus_target", { p_target_id: idSchema.parse(targetId) });
  if (error) throw error;
  refreshPerformancePaths(locale);
}

export async function reviewBonusTarget(locale: AppLocale, targetId: string, approve: boolean, formData: FormData) {
  const note = z.string().trim().max(1000).optional().parse(optionalString(formData.get("reviewNote")));
  if (!approve && (!note || note.length < 2)) throw new Error("A rejection reason is required.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("review_bonus_target", { p_target_id: idSchema.parse(targetId), p_approve: approve, p_note: note ?? "" });
  if (error) throw error;
  refreshPerformancePaths(locale);
}

const taskPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);
const taskRecurrenceSchema = z.enum(["none", "daily", "weekly", "monthly"]);
const taskScopeSchema = z.enum(["employees", "team", "branch", "company"]);
const announcementPrioritySchema = z.enum(["normal", "important", "critical"]);
const announcementScopeSchema = z.enum(["company", "branches", "teams", "employees", "roles"]);
const acceptedUploadTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function uploadedFiles(formData: FormData, field: string) {
  const files = formData.getAll(field).filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length > 5) throw new Error("Upload no more than five files at a time.");
  for (const file of files) {
    if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name} is larger than 20 MB.`);
    if (!acceptedUploadTypes.has(file.type)) throw new Error(`${file.name} must be a JPG, PNG, WebP, or PDF file.`);
  }
  return files;
}

function safeFileName(name: string) {
  return name.normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-120) || "file";
}

function refreshTaskPaths(locale: AppLocale, taskId?: string) {
  revalidatePath(`/${locale}/tasks`);
  if (taskId) revalidatePath(`/${locale}/tasks/${taskId}`);
  revalidatePath(`/${locale}/dashboard`);
}

export async function createOperationalTask(locale: AppLocale, tenantId: string, formData: FormData) {
  const scope = taskScopeSchema.parse(formData.get("scope"));
  const values = z.object({
    titleEn: z.string().trim().min(2).max(180), titleAr: z.string().trim().max(180).optional(),
    descriptionEn: z.string().trim().min(2).max(5000), descriptionAr: z.string().trim().max(5000).optional(),
    priority: taskPrioritySchema, startAt: z.string().min(10), dueAt: z.string().min(10), requireEvidence: z.boolean(),
    recurrence: taskRecurrenceSchema, recurrenceInterval: z.coerce.number().int().min(1).max(365), recurrenceEndDate: dateSchema.optional(),
  }).refine((value) => new Date(value.dueAt) > new Date(value.startAt), { message: "The due time must follow the start time." })
    .refine((value) => value.recurrence !== "none" || !value.recurrenceEndDate, { message: "One-time tasks cannot have a recurrence end date." }).parse({
      titleEn: formData.get("titleEn"), titleAr: optionalString(formData.get("titleAr")), descriptionEn: formData.get("descriptionEn"), descriptionAr: optionalString(formData.get("descriptionAr")),
      priority: formData.get("priority"), startAt: formData.get("startAt"), dueAt: formData.get("dueAt"), requireEvidence: formData.get("requireEvidence") === "on",
      recurrence: formData.get("recurrence"), recurrenceInterval: formData.get("recurrenceInterval") || "1", recurrenceEndDate: optionalString(formData.get("recurrenceEndDate")),
    });
  const scopeIds = formData.getAll("scopeIds").map(String).filter(Boolean).map((value) => idSchema.parse(value));
  if (scope !== "company" && !scopeIds.length) throw new Error("Select at least one employee, team, or branch.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_operational_task", {
    p_tenant_id: idSchema.parse(tenantId), p_title_en: values.titleEn, p_title_ar: values.titleAr ?? "", p_description_en: values.descriptionEn, p_description_ar: values.descriptionAr ?? "",
    p_priority: values.priority, p_start_at: new Date(values.startAt).toISOString(), p_due_at: new Date(values.dueAt).toISOString(), p_require_evidence: values.requireEvidence,
    p_recurrence: values.recurrence, p_recurrence_interval: values.recurrenceInterval, p_recurrence_end_date: values.recurrenceEndDate ?? null, p_scope: scope, p_scope_ids: scopeIds,
  });
  if (error) throw error;
  refreshTaskPaths(locale, data ? idSchema.parse(data) : undefined);
}

export async function startTaskAssignment(locale: AppLocale, taskId: string, assignmentId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("start_task_assignment", { p_assignment_id: idSchema.parse(assignmentId) });
  if (error) throw error;
  refreshTaskPaths(locale, taskId);
}

export async function submitTaskEvidence(locale: AppLocale, tenantId: string, taskId: string, assignmentId: string, formData: FormData) {
  const notes = z.string().trim().max(2000).optional().parse(optionalString(formData.get("notes")));
  const files = uploadedFiles(formData, "evidence");
  const supabase = await createSupabaseServerClient();
  const paths: string[] = [];
  const attachments: Array<{ storage_path: string; file_name: string; mime_type: string; size_bytes: number }> = [];
  try {
    for (const file of files) {
      const path = `${idSchema.parse(tenantId)}/${idSchema.parse(assignmentId)}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage.from("task-evidence").upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      paths.push(path);
      attachments.push({ storage_path: path, file_name: file.name, mime_type: file.type, size_bytes: file.size });
    }
    const { error } = await supabase.rpc("submit_task_assignment", { p_assignment_id: idSchema.parse(assignmentId), p_notes: notes ?? "", p_attachments: attachments });
    if (error) throw error;
  } catch (error) {
    if (paths.length) await supabase.storage.from("task-evidence").remove(paths);
    throw error;
  }
  refreshTaskPaths(locale, taskId);
}

export async function reviewTaskEvidence(locale: AppLocale, taskId: string, assignmentId: string, approve: boolean, formData: FormData) {
  const note = z.string().trim().max(2000).optional().parse(optionalString(formData.get("reviewNote")));
  if (!approve && (!note || note.length < 2)) throw new Error("A reason is required when requesting changes.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("review_task_assignment", { p_assignment_id: idSchema.parse(assignmentId), p_approve: approve, p_note: note ?? "" });
  if (error) throw error;
  refreshTaskPaths(locale, taskId);
}

export async function addTaskComment(locale: AppLocale, taskId: string, formData: FormData) {
  const body = z.string().trim().min(1).max(2000).parse(formData.get("body"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("add_task_comment", { p_task_id: idSchema.parse(taskId), p_body: body });
  if (error) throw error;
  refreshTaskPaths(locale, taskId);
}

export async function cancelOperationalTask(locale: AppLocale, taskId: string, formData: FormData) {
  const reason = z.string().trim().min(2).max(2000).parse(formData.get("reason"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_operational_task", { p_task_id: idSchema.parse(taskId), p_reason: reason });
  if (error) throw error;
  refreshTaskPaths(locale, taskId);
}

function refreshAnnouncementPaths(locale: AppLocale) {
  revalidatePath(`/${locale}/announcements`);
  revalidatePath(`/${locale}/dashboard`);
}

export async function createAnnouncement(locale: AppLocale, tenantId: string, formData: FormData) {
  const scope = announcementScopeSchema.parse(formData.get("scope"));
  const expiresValue = optionalString(formData.get("expiresAt"));
  const values = z.object({
    titleEn: z.string().trim().min(2).max(180), titleAr: z.string().trim().max(180).optional(), bodyEn: z.string().trim().min(2).max(10000), bodyAr: z.string().trim().max(10000).optional(),
    priority: announcementPrioritySchema, pinned: z.boolean(), acknowledgement: z.boolean(),
  }).parse({ titleEn: formData.get("titleEn"), titleAr: optionalString(formData.get("titleAr")), bodyEn: formData.get("bodyEn"), bodyAr: optionalString(formData.get("bodyAr")), priority: formData.get("priority"), pinned: formData.get("pinned") === "on", acknowledgement: formData.get("acknowledgement") === "on" });
  const scopeIds = formData.getAll("scopeIds").map(String).filter(Boolean).map((value) => idSchema.parse(value));
  if (scope !== "company" && !scopeIds.length) throw new Error("Select at least one audience.");
  const files = uploadedFiles(formData, "attachments");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_announcement", {
    p_tenant_id: idSchema.parse(tenantId), p_title_en: values.titleEn, p_title_ar: values.titleAr ?? "", p_body_en: values.bodyEn, p_body_ar: values.bodyAr ?? "", p_priority: values.priority,
    p_is_pinned: values.pinned, p_requires_acknowledgement: values.acknowledgement, p_expires_at: expiresValue ? new Date(expiresValue).toISOString() : null, p_scope: scope, p_scope_ids: scopeIds,
  });
  if (error) throw error;
  const announcementId = idSchema.parse(data);
  for (const file of files) {
    const path = `${idSchema.parse(tenantId)}/${announcementId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage.from("announcement-files").upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    const { error: metadataError } = await supabase.rpc("add_announcement_attachment", { p_announcement_id: announcementId, p_storage_path: path, p_file_name: file.name, p_mime_type: file.type, p_size_bytes: file.size });
    if (metadataError) { await supabase.storage.from("announcement-files").remove([path]); throw metadataError; }
  }
  refreshAnnouncementPaths(locale);
}

export async function publishAnnouncement(locale: AppLocale, announcementId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("publish_announcement", { p_announcement_id: idSchema.parse(announcementId) });
  if (error) throw error;
  refreshAnnouncementPaths(locale);
}

export async function markAnnouncementRead(locale: AppLocale, announcementId: string, acknowledge: boolean) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("mark_announcement_read", { p_announcement_id: idSchema.parse(announcementId), p_acknowledge: acknowledge });
  if (error) throw error;
  refreshAnnouncementPaths(locale);
}

export async function archiveAnnouncement(locale: AppLocale, announcementId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("archive_announcement", { p_announcement_id: idSchema.parse(announcementId) });
  if (error) throw error;
  refreshAnnouncementPaths(locale);
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
  const tenantIdValue = idSchema.parse(tenantId);
  const { data: branch, error: branchError } = await supabase.from("branches")
    .select("week_start_isodow")
    .eq("tenant_id", tenantIdValue)
    .eq("id", values.branchId)
    .eq("is_active", true)
    .maybeSingle();
  if (branchError) throw branchError;
  if (!branch) throw new Error("The selected branch is unavailable.");
  const normalizedWeekStart = configuredWeekStart(values.weekStart, branch.week_start_isodow);

  const { data: existing, error: existingError } = await supabase.from("weekly_schedules")
    .select("id")
    .eq("tenant_id", tenantIdValue)
    .eq("branch_id", values.branchId)
    .eq("week_start", normalizedWeekStart)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) redirect(`/${locale}/schedules/${existing.id}`);

  const { data, error } = await supabase.from("weekly_schedules").insert({
    tenant_id: tenantIdValue,
    branch_id: values.branchId,
    week_start: normalizedWeekStart,
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

export async function createAttendanceDevice(locale: AppLocale, tenantId: string, formData: FormData) {
  const values = z.object({
    branchId: optionalId,
    code: codeSchema,
    name: z.string().trim().min(2).max(120),
    provider: z.string().trim().min(2).max(80),
    model: z.string().trim().max(100).optional(),
    serialNumber: z.string().trim().max(120).optional(),
    connectionMode: z.enum(["file", "api", "database", "sdk"]),
    timezone: z.string().trim().min(3).max(80),
  }).parse({
    branchId: optionalString(formData.get("branchId")),
    code: formData.get("code"),
    name: formData.get("name"),
    provider: formData.get("provider") || "generic",
    model: optionalString(formData.get("model")),
    serialNumber: optionalString(formData.get("serialNumber")),
    connectionMode: formData.get("connectionMode"),
    timezone: formData.get("timezone"),
  });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_attendance_device", {
    p_tenant_id: idSchema.parse(tenantId),
    p_branch_id: values.branchId ?? null,
    p_code: values.code,
    p_name: values.name,
    p_provider: values.provider,
    p_model: values.model ?? null,
    p_serial_number: values.serialNumber ?? null,
    p_connection_mode: values.connectionMode,
    p_timezone: values.timezone,
  });
  if (error) throw error;
  revalidatePath(`/${locale}/attendance/devices`);
  revalidatePath(`/${locale}/audit`);
}

export async function setAttendanceDeviceStatus(locale: AppLocale, deviceId: string, status: "active" | "inactive") {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_attendance_device_status", {
    p_device_id: idSchema.parse(deviceId),
    p_status: status,
  });
  if (error) throw error;
  revalidatePath(`/${locale}/attendance/devices`);
  revalidatePath(`/${locale}/audit`);
}

function commaList(value: FormDataEntryValue | null) {
  return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 30);
}

function decodeAttendanceText(buffer: Buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return new TextDecoder("utf-16le").decode(buffer.subarray(2));
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.allocUnsafe(buffer.length - 2);
    for (let index = 2; index + 1 < buffer.length; index += 2) {
      swapped[index - 2] = buffer[index + 1];
      swapped[index - 1] = buffer[index];
    }
    return new TextDecoder("utf-16le").decode(swapped);
  }
  return new TextDecoder("utf-8").decode(buffer);
}

export async function importFingerprintAttendance(locale: AppLocale, tenantId: string, formData: FormData) {
  idSchema.parse(tenantId);
  const deviceId = idSchema.parse(formData.get("deviceId"));
  const fileValue = formData.get("attendanceFile");
  if (!(fileValue instanceof File) || !fileValue.name || fileValue.size < 1) throw new Error("Choose a CSV or XLSX attendance file.");
  if (fileValue.size > 8 * 1024 * 1024) throw new Error("Attendance files are limited to 8 MB.");
  const extension = fileValue.name.split(".").pop()?.toLowerCase();
  if (!extension || !["csv", "txt", "xlsx"].includes(extension)) throw new Error("Use a CSV, TXT, or XLSX attendance file.");

  const overrides: AttendanceColumnOverrides = {
    employee: optionalString(formData.get("employeeColumn")),
    occurredAt: optionalString(formData.get("occurredAtColumn")),
    punchType: optionalString(formData.get("punchTypeColumn")),
    externalReference: optionalString(formData.get("referenceColumn")),
    branchCode: optionalString(formData.get("branchColumn")),
    checkInValues: commaList(formData.get("checkInValues")),
    checkOutValues: commaList(formData.get("checkOutValues")),
  };
  const fileBuffer = Buffer.from(await fileValue.arrayBuffer());
  const parsed = extension === "xlsx"
    ? parseAttendanceTable((await (await import("read-excel-file/node")).readSheet(fileBuffer)) as AttendanceImportCell[][], overrides)
    : parseAttendanceCsv(decodeAttendanceText(fileBuffer), overrides);
  const checksum = createHash("sha256").update(fileBuffer).digest("hex");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("import_fingerprint_punches", {
    p_device_id: deviceId,
    p_file_name: fileValue.name,
    p_file_sha256: checksum,
    p_rows: parsed.rows,
    p_mapping: parsed.mapping,
  });
  if (error) throw error;
  revalidatePath(`/${locale}/attendance/devices`);
  revalidatePath(`/${locale}/attendance`);
  revalidatePath(`/${locale}/reports`);
}
