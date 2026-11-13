/** Shapes returned by the BMD field portal endpoints (/api/bmd/*). */

export type BmdLevel = "normal" | "alert" | "warning" | "danger" | "extreme";
export type BmdTrend = "rising" | "steady" | "falling" | "unknown";

export const BMD_LEVELS: BmdLevel[] = ["normal", "alert", "warning", "danger", "extreme"];
export const BMD_TRENDS: BmdTrend[] = ["rising", "steady", "falling", "unknown"];

export interface BmdDistrictRef {
  id: string;
  name_en: string;
  name_bn: string;
  division: string;
}

export interface BmdOfficerPublic {
  name: string;
  designation: string;
  office: string;
  verified: boolean;
}

export interface BmdOfficer extends BmdOfficerPublic {
  id: number;
  email: string;
  phone: string;
  employee_id: string;
  status: "pending" | "verified" | "suspended";
  station: BmdDistrictRef;
  joined: string;
  report_count: number;
}

export interface BmdSession {
  authenticated: boolean;
  officer: BmdOfficer | null;
}

export interface BmdReport {
  id: number;
  district: BmdDistrictRef;
  officer: BmdOfficerPublic;
  level: BmdLevel;
  water_trend: BmdTrend;
  rainfall_24h_mm: number | null;
  river_station: string;
  water_level_m: number | null;
  danger_level_m: number | null;
  affected_people: number | null;
  shelters_open: number | null;
  conditions: string;
  actions_taken: string;
  needs: string;
  observed_at: string;
  created_at: string;
  updated_at: string;
  mine: boolean;
}

export interface BmdReportInput {
  level: BmdLevel | "";
  water_trend: BmdTrend;
  rainfall_24h_mm: string;
  river_station: string;
  water_level_m: string;
  danger_level_m: string;
  affected_people: string;
  shelters_open: string;
  conditions: string;
  actions_taken: string;
  needs: string;
  observed_at: string;
}

export interface BmdRegisterInput {
  full_name: string;
  email: string;
  password: string;
  designation: string;
  employee_id: string;
  phone: string;
  office_name: string;
  district: string;
}

export interface BmdBoardRow {
  district: BmdDistrictRef;
  level: BmdLevel;
  water_trend: BmdTrend;
  observed_at: string;
  report_id: number;
  officer: BmdOfficerPublic;
}

export interface BmdSummary {
  generated_at: string;
  reports_24h: number;
  reports_7d: number;
  districts_reporting_7d: number;
  districts_total: number;
  danger_or_worse: number;
  by_level: Record<BmdLevel, number>;
  officers: number;
  officers_verified: number;
  people_affected: number;
  shelters_open: number;
  board: BmdBoardRow[];
}

export interface BmdReportQuery {
  district?: string;
  division?: string;
  level?: BmdLevel | "";
  hours?: number | "";
  verified?: boolean;
  mine?: boolean;
  limit?: number;
}
