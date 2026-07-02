import api from "./client";
import type {
  PageResponse,
  GymGrade,
  AdminGymDetail,
  AdminDashboardResponse,
  AdminAuditLogResponse,
  AdminModelMetricsResponse,
  AdminUserSearchResponse,
  AdminUserDetailResponse,
  AdminUserStatusRequest,
  AdminUserRoleRequest,
  AdminReasonRequest,
  AdminReportResponse,
  AdminReportStatusRequest,
  AdminGymSearchResponse,
  AdminGymUpsertRequest,
  AdminGymGradeReplaceRequest,
  AdminGymImportRequest,
  AdminGymImportPreviewResponse,
  AdminGymImportApplyResponse,
} from "@/types/api";

// 클라이언트 응답 인터셉터가 ApiResponse<T> 를 언랩하므로 모든 메서드는 { data: T } 로 resolve.
// 경로는 상대 — web 은 /api, 네이티브는 VITE_API_BASE_URL prefix.

export interface AdminUserSearchParams {
  status?: string;
  role?: string;
  keyword?: string;
  emailVerified?: boolean;
  page?: number;
  size?: number;
}

export interface AdminReportSearchParams {
  status?: string;
  targetType?: string;
  category?: string;
  page?: number;
  size?: number;
}

export interface AdminGymSearchParams {
  status?: string;
  keyword?: string;
  regionCode?: string;
  page?: number;
  size?: number;
}

export interface AdminAuditLogParams {
  targetType?: string;
  targetId?: number;
  adminId?: number;
  page?: number;
  size?: number;
}

export const adminService = {
  // ── Dashboard / 공통 ────────────────────────────────────────────────────────
  getDashboard: () => api.get<AdminDashboardResponse>("/admin/dashboard"),

  getAuditLogs: (params: AdminAuditLogParams) => api.get<PageResponse<AdminAuditLogResponse>>("/admin/audit-logs", { params }),

  getModelMetrics: (modelVersion: string) => api.get<AdminModelMetricsResponse>(`/admin/analysis/models/${encodeURIComponent(modelVersion)}/metrics`),

  // ── 회원 ──────────────────────────────────────────────────────────────────
  searchUsers: (params: AdminUserSearchParams) => api.get<PageResponse<AdminUserSearchResponse>>("/admin/users", { params }),

  getUser: (userId: number) => api.get<AdminUserDetailResponse>(`/admin/users/${userId}`),

  changeUserStatus: (userId: number, body: AdminUserStatusRequest) => api.patch<AdminUserDetailResponse>(`/admin/users/${userId}/status`, body),

  changeUserRole: (userId: number, body: AdminUserRoleRequest) => api.patch<AdminUserDetailResponse>(`/admin/users/${userId}/role`, body),

  revokeUserTokens: (userId: number, body: AdminReasonRequest) => api.post<AdminUserDetailResponse>(`/admin/users/${userId}/revoke-tokens`, body),

  // ── 신고 ──────────────────────────────────────────────────────────────────
  searchReports: (params: AdminReportSearchParams) => api.get<PageResponse<AdminReportResponse>>("/admin/reports", { params }),

  changeReportStatus: (reportId: number, body: AdminReportStatusRequest) => api.patch<AdminReportResponse>(`/admin/reports/${reportId}/status`, body),

  // ── 암장 ──────────────────────────────────────────────────────────────────
  searchGyms: (params: AdminGymSearchParams) => api.get<PageResponse<AdminGymSearchResponse>>("/admin/gyms", { params }),

  getGym: (gymId: number) => api.get<AdminGymDetail>(`/admin/gyms/${gymId}`),

  createGym: (body: AdminGymUpsertRequest) => api.post<AdminGymDetail>("/admin/gyms", body),

  updateGym: (gymId: number, body: AdminGymUpsertRequest) => api.patch<AdminGymDetail>(`/admin/gyms/${gymId}`, body),

  approveGym: (gymId: number, body: AdminReasonRequest) => api.post<AdminGymDetail>(`/admin/gyms/${gymId}/approve`, body),

  rejectGym: (gymId: number, body: AdminReasonRequest) => api.post<AdminGymDetail>(`/admin/gyms/${gymId}/reject`, body),

  closeGym: (gymId: number, body: AdminReasonRequest) => api.post<AdminGymDetail>(`/admin/gyms/${gymId}/close`, body),

  replaceGrades: (gymId: number, body: AdminGymGradeReplaceRequest) => api.put<GymGrade[]>(`/admin/gyms/${gymId}/grades`, body),

  uploadGymImage: (gymId: number, image: File) => {
    const form = new FormData();
    form.append("image", image);
    return api.post<AdminGymDetail>(`/admin/gyms/${gymId}/profile-image`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  previewImport: (body: AdminGymImportRequest) => api.post<AdminGymImportPreviewResponse>("/admin/gyms/import/preview", body),

  applyImport: (body: AdminGymImportRequest) => api.post<AdminGymImportApplyResponse>("/admin/gyms/import", body),
};
