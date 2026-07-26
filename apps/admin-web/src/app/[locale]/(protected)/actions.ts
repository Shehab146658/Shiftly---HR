"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppLocale } from "@/lib/i18n";

const idSchema = z.string().uuid();
const codeSchema = z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9_-]+$/);

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
    nameAr: formData.get("nameAr") || undefined,
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
  }).parse({ code: formData.get("code"), nameEn: formData.get("nameEn"), nameAr: formData.get("nameAr") || undefined });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("branches").insert({
    tenant_id: idSchema.parse(tenantId), code: values.code.toUpperCase(), name_en: values.nameEn, name_ar: values.nameAr ?? null,
  });
  if (error) throw error;
  revalidatePath(`/${locale}/branches`);
}

export async function createTeam(locale: AppLocale, tenantId: string, formData: FormData) {
  const values = z.object({
    code: codeSchema,
    nameEn: z.string().trim().min(2).max(150),
    nameAr: z.string().trim().max(150).optional(),
    branchId: z.string().uuid().optional(),
  }).parse({
    code: formData.get("code"), nameEn: formData.get("nameEn"), nameAr: formData.get("nameAr") || undefined,
    branchId: formData.get("branchId") || undefined,
  });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("teams").insert({
    tenant_id: idSchema.parse(tenantId), branch_id: values.branchId ?? null, code: values.code.toUpperCase(),
    name_en: values.nameEn, name_ar: values.nameAr ?? null,
  });
  if (error) throw error;
  revalidatePath(`/${locale}/teams`);
}

export async function createEmployee(locale: AppLocale, tenantId: string, formData: FormData) {
  const values = z.object({
    employeeCode: codeSchema,
    nameEn: z.string().trim().min(2).max(150),
    nameAr: z.string().trim().max(150).optional(),
    position: z.string().trim().max(150).optional(),
    branchId: z.string().uuid().optional(),
    teamId: z.string().uuid().optional(),
  }).parse({
    employeeCode: formData.get("employeeCode"), nameEn: formData.get("nameEn"), nameAr: formData.get("nameAr") || undefined,
    position: formData.get("position") || undefined, branchId: formData.get("branchId") || undefined,
    teamId: formData.get("teamId") || undefined,
  });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("employees").insert({
    tenant_id: idSchema.parse(tenantId), employee_code: values.employeeCode.toUpperCase(), name_en: values.nameEn,
    name_ar: values.nameAr ?? null, position: values.position ?? null, branch_id: values.branchId ?? null,
    team_id: values.teamId ?? null,
  });
  if (error) throw error;
  revalidatePath(`/${locale}/employees`);
}
