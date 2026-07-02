<script setup lang="ts">
// imports → composables → state → methods → lifecycle
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { adminService } from "@/services/admin";
import { useUIStore } from "@/stores/ui";
import type { AdminReportResponse, AdminReportStatusRequest } from "@/types/api";
import { reportStatusOptions, reportTargetTypeOptions, reportCategoryOptions, getReportStatusMeta, getReportTargetTypeMeta, reportCategoryLabels } from "@/utils/adminLabels";
import { formatDateTime } from "@/utils/adminFormat";
import AdminFilterBar from "@/components/admin/AdminFilterBar.vue";
import AdminDataTable, { type AdminColumn } from "@/components/admin/AdminDataTable.vue";
import AdminPagination from "@/components/admin/AdminPagination.vue";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge.vue";
import AdminIcon from "@/components/admin/AdminIcon.vue";
import ReportResolveDialog from "@/components/admin/ReportResolveDialog.vue";

const router = useRouter();
const uiStore = useUIStore();

const rows = ref<AdminReportResponse[]>([]);
const loading = ref(false);
const page = ref(0);
const totalPages = ref(0);
const totalElements = ref(0);

const status = ref("");
const targetType = ref("");
const category = ref("");

const selected = ref<AdminReportResponse | null>(null);
const dialogOpen = ref(false);
const submitting = ref(false);

const columns: AdminColumn[] = [
  { key: "id", label: "ID", width: "60px" },
  { key: "targetType", label: "대상", width: "130px" },
  { key: "category", label: "카테고리", width: "100px" },
  { key: "reason", label: "사유", width: "1.4fr" },
  { key: "status", label: "상태", width: "100px" },
  { key: "createdAt", label: "신고일", width: "140px" },
  { key: "actions", label: "", width: "170px", align: "right" },
];

function categoryLabel(cat: string): string {
  return (reportCategoryLabels as Record<string, string>)[cat] ?? cat;
}

// 신고 대상 바로가기. 영상 → 조회 페이지, 회원 → 어드민 회원 상세.
// 댓글은 신고 데이터에 부모 영상 ID가 없어 딥링크가 불가하다(백엔드 보강 필요).
function targetLink(row: AdminReportResponse): string | null {
  const type = row.targetType?.toLowerCase();
  if (type === "video") return `/videos/${row.targetId}`;
  if (type === "user") return `/admin/users/${row.targetId}`;
  return null;
}
function openTarget(row: AdminReportResponse) {
  const link = targetLink(row);
  if (link) router.push(link);
}

async function load(toPage = page.value) {
  loading.value = true;
  try {
    const { data } = await adminService.searchReports({
      status: status.value || undefined,
      targetType: targetType.value || undefined,
      category: category.value || undefined,
      page: toPage,
      size: 20,
    });
    rows.value = data.content;
    page.value = data.page;
    totalPages.value = data.totalPages;
    totalElements.value = data.totalElements;
  } catch {
    uiStore.showToast("신고 목록을 불러오지 못했어요.", "danger");
  } finally {
    loading.value = false;
  }
}

function search() {
  load(0);
}

function openResolve(report: AdminReportResponse) {
  selected.value = report;
  dialogOpen.value = true;
}

async function onResolve(body: AdminReportStatusRequest) {
  if (!selected.value) return;
  submitting.value = true;
  try {
    await adminService.changeReportStatus(selected.value.id, body);
    dialogOpen.value = false;
    uiStore.showToast("신고를 처리했어요.", "success");
    await load();
  } catch {
    uiStore.showToast("처리에 실패했어요. 대상 타입과 조치를 확인해 주세요.", "danger");
  } finally {
    submitting.value = false;
  }
}

onMounted(() => load(0));
</script>

<template>
  <section class="admin-page">
    <div class="admin-page-head">
      <div>
        <h1 class="admin-page-title">신고</h1>
        <p class="admin-page-sub">신고를 검토하고 조치를 적용해요.</p>
      </div>
    </div>

    <div class="admin-card">
      <AdminFilterBar keyword="" :searchable="false">
        <select v-model="status" class="admin-select" aria-label="상태 필터" @change="search">
          <option value="">전체 상태</option>
          <option v-for="opt in reportStatusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <select v-model="targetType" class="admin-select" aria-label="대상 필터" @change="search">
          <option value="">전체 대상</option>
          <option v-for="opt in reportTargetTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <select v-model="category" class="admin-select" aria-label="카테고리 필터" @change="search">
          <option value="">전체 카테고리</option>
          <option v-for="opt in reportCategoryOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </AdminFilterBar>

      <div class="table-wrap">
        <AdminDataTable :columns="columns" :rows="rows" :row-key="(r) => r.id" :loading="loading" empty-text="검색 결과가 없어요.">
          <template #cell-id="{ row }">
            <span class="muted">#{{ row.id }}</span>
          </template>
          <template #cell-targetType="{ row }">
            <div class="target-cell">
              <AdminStatusBadge :label="getReportTargetTypeMeta(row.targetType).label" :tone="getReportTargetTypeMeta(row.targetType).tone" />
              <span class="muted">#{{ row.targetId }}</span>
            </div>
          </template>
          <template #cell-category="{ row }">{{ categoryLabel(row.category) }}</template>
          <template #cell-reason="{ row }">
            <span class="reason">{{ row.reason || "—" }}</span>
          </template>
          <template #cell-status="{ row }">
            <AdminStatusBadge :label="getReportStatusMeta(row.status).label" :tone="getReportStatusMeta(row.status).tone" />
          </template>
          <template #cell-createdAt="{ row }">
            <span class="muted">{{ formatDateTime(row.createdAt) }}</span>
          </template>
          <template #cell-actions="{ row }">
            <div class="row-actions">
              <button v-if="targetLink(row)" class="admin-btn" @click="openTarget(row)">
                <AdminIcon name="open" :size="15" />
                대상 보기
              </button>
              <button class="admin-btn admin-btn--primary" @click="openResolve(row)">처리</button>
            </div>
          </template>
        </AdminDataTable>
      </div>

      <AdminPagination :page="page" :total-pages="totalPages" :total-elements="totalElements" @change="load" />
    </div>

    <ReportResolveDialog :open="dialogOpen" :report="selected" :loading="submitting" @confirm="onResolve" @cancel="dialogOpen = false" />
  </section>
</template>

<style scoped>
.admin-page {
  max-width: 1080px;
}
.table-wrap {
  margin-top: 18px;
}
.muted {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
}
.target-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.row-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}
.reason {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
