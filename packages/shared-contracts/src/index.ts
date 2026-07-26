export type Locale = "en" | "ar";

export type MembershipStatus = "invited" | "active" | "suspended" | "revoked";
export type EmployeeStatus = "active" | "inactive" | "on_leave" | "terminated";

export interface TenantSummary {
  id: string;
  slug: string;
  nameEn: string;
  nameAr?: string | null;
  status: "trial" | "active" | "suspended" | "cancelled";
  timezone: string;
  defaultLocale: Locale;
}

export interface BranchSummary {
  id: string;
  tenantId: string;
  code: string;
  nameEn: string;
  nameAr?: string | null;
  isActive: boolean;
}

export interface TeamSummary {
  id: string;
  tenantId: string;
  branchId?: string | null;
  code: string;
  nameEn: string;
  nameAr?: string | null;
  isActive: boolean;
}

export interface EmployeeSummary {
  id: string;
  tenantId: string;
  employeeCode: string;
  nameEn: string;
  nameAr?: string | null;
  position?: string | null;
  branchId?: string | null;
  teamId?: string | null;
  status: EmployeeStatus;
}
