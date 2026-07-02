// 어드민 상태/열거값 → 한국어 UI 라벨 + 배지 색상 매핑.
// 새 상태/액션을 추가하면 여기에도 반드시 추가한다.
// 색상만으로 상태를 구분하지 않도록 라벨 텍스트를 항상 병행한다 (접근성).

import type {
  AdminUserStatus,
  UserRole,
  AdminGymStatus,
  AdminReportStatus,
  AdminReportTargetType,
  AdminReportCategory,
  ReportResolutionAction,
} from "@/types/api";

/** 배지 색상 토큰. AdminStatusBadge 가 tint/foreground 매핑에 사용. */
export type BadgeTone = "neutral" | "pink" | "lime" | "orange" | "cyan" | "dark";

interface LabelMeta {
  label: string;
  tone: BadgeTone;
}

/** 알 수 없는 값이 오면 원본 값을 그대로 라벨로 보여주는 중립 배지 (절대 throw 하지 않음). */
function fallbackMeta(raw: string | null | undefined): LabelMeta {
  return { label: raw ?? "알 수 없음", tone: "neutral" };
}

/**
 * 고정 매핑 테이블 조회 헬퍼. 백엔드가 문서 예시와 다른 케이싱(예: 대문자 enum)이나
 * 새 값을 내려줘도 페이지가 죽지 않도록 대/소문자 폴백을 거친 뒤 원본 값으로 대체한다.
 */
function lookupMeta<K extends string>(map: Record<K, LabelMeta>, raw: string | null | undefined): LabelMeta {
  if (raw == null) return fallbackMeta(raw);
  return map[raw as K] ?? map[raw.toLowerCase() as K] ?? map[raw.toUpperCase() as K] ?? fallbackMeta(raw);
}

// ── 회원 ────────────────────────────────────────────────────────────────────

export const userStatusMeta: Record<AdminUserStatus, LabelMeta> = {
  ACTIVE: { label: "활성", tone: "lime" },
  SUSPENDED: { label: "정지", tone: "orange" },
  DELETED: { label: "탈퇴", tone: "neutral" },
};
export const getUserStatusMeta = (status: string | null | undefined) => lookupMeta(userStatusMeta, status);

export const userRoleMeta: Record<UserRole, LabelMeta> = {
  USER: { label: "일반", tone: "neutral" },
  ADMIN: { label: "관리자", tone: "dark" },
};
export const getUserRoleMeta = (role: string | null | undefined) => lookupMeta(userRoleMeta, role);

// ── 암장 ────────────────────────────────────────────────────────────────────

export const gymStatusMeta: Record<AdminGymStatus, LabelMeta> = {
  pending: { label: "승인 대기", tone: "pink" },
  active: { label: "운영중", tone: "lime" },
  closed: { label: "폐쇄", tone: "neutral" },
};
export const getGymStatusMeta = (status: string | null | undefined) => lookupMeta(gymStatusMeta, status);

// ── 신고 ────────────────────────────────────────────────────────────────────

export const reportStatusMeta: Record<AdminReportStatus, LabelMeta> = {
  reviewed: { label: "검토됨", tone: "cyan" },
  resolved: { label: "처리 완료", tone: "lime" },
  rejected: { label: "반려", tone: "neutral" },
};
export const getReportStatusMeta = (status: string | null | undefined) => lookupMeta(reportStatusMeta, status);

export const reportTargetTypeMeta: Record<AdminReportTargetType, LabelMeta> = {
  user: { label: "회원", tone: "orange" },
  video: { label: "영상", tone: "pink" },
  comment: { label: "댓글", tone: "neutral" },
};
export const getReportTargetTypeMeta = (targetType: string | null | undefined) => lookupMeta(reportTargetTypeMeta, targetType);

export const reportCategoryLabels: Record<AdminReportCategory, string> = {
  obscene: "음란성",
  copyright: "저작권",
  abuse: "욕설/비방",
  spam: "스팸/광고",
  irrelevant: "주제 무관",
  etc: "기타",
};

export const resolutionActionLabels: Record<ReportResolutionAction, string> = {
  none: "조치 없음",
  delete_video: "영상 삭제",
  delete_comment: "댓글 삭제",
  suspend_user: "회원 정지",
};

/** 신고 대상 타입별 허용 가능한 조치 (백엔드 검증과 일치). */
export const allowedActionsByTarget: Record<AdminReportTargetType, ReportResolutionAction[]> = {
  video: ["none", "delete_video", "suspend_user"],
  comment: ["none", "delete_comment", "suspend_user"],
  user: ["none", "suspend_user"],
};
/** 알 수 없는 targetType 이면 안전하게 "조치 없음"만 허용한다. */
export function getAllowedActions(targetType: string | null | undefined): ReportResolutionAction[] {
  if (targetType == null) return ["none"];
  return allowedActionsByTarget[targetType as AdminReportTargetType] ?? allowedActionsByTarget[targetType.toLowerCase() as AdminReportTargetType] ?? ["none"];
}

// ── 감사 로그 action ─────────────────────────────────────────────────────────

export const auditActionLabels: Record<string, string> = {
  USER_STATUS_CHANGE: "회원 상태 변경",
  USER_ROLE_CHANGE: "회원 역할 변경",
  USER_TOKEN_REVOKE: "토큰 폐기",
  REPORT_STATUS_CHANGE: "신고 상태 변경",
  MODERATION_DELETE_VIDEO: "영상 삭제",
  MODERATION_DELETE_COMMENT: "댓글 삭제",
  MODERATION_SUSPEND_USER: "회원 정지",
  GYM_CREATE: "암장 생성",
  GYM_UPDATE: "암장 수정",
  GYM_APPROVE: "암장 승인",
  GYM_REJECT: "암장 반려",
  GYM_CLOSE: "암장 폐쇄",
  GYM_GRADES_REPLACE: "등급 교체",
  GYM_PROFILE_IMAGE_UPDATE: "프로필 이미지 변경",
  GYM_IMPORT: "암장 일괄 등록",
};

export function getAuditActionLabel(action: string): string {
  return auditActionLabels[action] ?? action;
}

// ── 옵션 목록 (필터/셀렉트용) ─────────────────────────────────────────────────

export const userStatusOptions = (Object.keys(userStatusMeta) as AdminUserStatus[]).map((v) => ({ value: v, label: userStatusMeta[v].label }));
export const userRoleOptions = (Object.keys(userRoleMeta) as UserRole[]).map((v) => ({ value: v, label: userRoleMeta[v].label }));
export const gymStatusOptions = (Object.keys(gymStatusMeta) as AdminGymStatus[]).map((v) => ({ value: v, label: gymStatusMeta[v].label }));
export const reportStatusOptions = (Object.keys(reportStatusMeta) as AdminReportStatus[]).map((v) => ({ value: v, label: reportStatusMeta[v].label }));
export const reportTargetTypeOptions = (Object.keys(reportTargetTypeMeta) as AdminReportTargetType[]).map((v) => ({ value: v, label: reportTargetTypeMeta[v].label }));
export const reportCategoryOptions = (Object.keys(reportCategoryLabels) as AdminReportCategory[]).map((v) => ({ value: v, label: reportCategoryLabels[v] }));
