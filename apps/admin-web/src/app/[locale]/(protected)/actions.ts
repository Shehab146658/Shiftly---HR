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
    defaultScheduleVisibility: z.enum(["self", "team", "branch", "all"]),
  }).parse({
    operationalDayStart: formData.get("operationalDayStart"),
    maximumShiftHours: formData.get("maximumShiftHours"),
    weekStartIsodow: formData.get("weekStartIsodow"),
    defaultScheduleVisibility: formData.get("defaultScheduleVisibility"),
  });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("branches").update({
    operational_day_start: values.operationalDayStart,
    maximum_shift_hours: values.maximumShiftHours,
    week_start_isodow: values.weekStartIsodow,
    default_schedule_visibility: values.defaultScheduleVisibility,
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
    branch_id: values.branchId ?? null,
    team_id: values.teamId ?? null,
    manager_employee_id: values.managerEmployeeId ?? null,
    notes: values.notes ?? null,
  };
}

export async function createEmployee(locale: AppLocale, tenantId: string, formData: FormData) {
  const values = parseEmployeeForm(formData);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("employees").insert(employeePayload(tenantId, values));
  if (error) throw error;
  revalidatePath(`/${locale}/employees`);
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
