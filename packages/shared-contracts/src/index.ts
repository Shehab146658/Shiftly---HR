export type Locale = "en" | "ar";

export type MembershipStatus = "invited" | "active" | "suspended" | "revoked";
export type EmployeeStatus = "active" | "inactive" | "on_leave" | "terminated";
export type ScheduleStatus = "draft" | "published" | "locked" | "archived";
export type ScheduleEntryType = "shift" | "off" | "leave" | "training" | "assignment";
export type ScheduleVisibility = "self" | "team" | "branch" | "all";

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
  operationalDayStart: string;
  maximumShiftHours: number;
  defaultScheduleVisibility: ScheduleVisibility;
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
  email?: string | null;
  phone?: string | null;
  position?: string | null;
  branchId?: string | null;
  teamId?: string | null;
  managerEmployeeId?: string | null;
  preferredLocale: Locale;
  status: EmployeeStatus;
}

export interface ShiftTemplateSummary {
  id: string;
  tenantId: string;
  branchId?: string | null;
  code: string;
  nameEn: string;
  nameAr?: string | null;
  startTime: string;
  endTime: string;
  endDayOffset: 0 | 1;
  breakMinutes: number;
  isActive: boolean;
}

export interface WeeklyScheduleSummary {
  id: string;
  tenantId: string;
  branchId: string;
  weekStart: string;
  status: ScheduleStatus;
  visibility: ScheduleVisibility;
}

export interface ScheduleEntrySummary {
  id: string;
  scheduleId: string;
  employeeId: string;
  scheduledBranchId: string;
  workDate: string;
  segmentNo: number;
  entryType: ScheduleEntryType;
  shiftTemplateId?: string | null;
  customStartTime?: string | null;
  customEndTime?: string | null;
  endDayOffset: 0 | 1;
  breakMinutes: number;
}
