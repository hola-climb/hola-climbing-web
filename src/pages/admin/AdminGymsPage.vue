<script setup lang="ts">
// imports → composables → state → methods → lifecycle
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { adminService } from "@/services/admin";
import { useUIStore } from "@/stores/ui";
import type { AdminGymSearchResponse, AdminGymUpsertRequest, AdminGymImportRow, AdminGymImportPreviewResponse } from "@/types/api";
import { gymStatusOptions, getGymStatusMeta } from "@/utils/adminLabels";
import { formatDate } from "@/utils/adminFormat";
import AdminFilterBar from "@/components/admin/AdminFilterBar.vue";
import AdminDataTable, { type AdminColumn } from "@/components/admin/AdminDataTable.vue";
import AdminPagination from "@/components/admin/AdminPagination.vue";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge.vue";
import AdminReasonDialog from "@/components/admin/AdminReasonDialog.vue";
import GymUpsertModal from "@/components/admin/GymUpsertModal.vue";
import GymImportModal from "@/components/admin/GymImportModal.vue";
import AdminIcon from "@/components/admin/AdminIcon.vue";

const route = useRoute();
const router = useRouter();
const uiStore = useUIStore();

const rows = ref<AdminGymSearchResponse[]>([]);
const loading = ref(false);
const page = ref(0);
const totalPages = ref(0);
const totalElements = ref(0);

const status = ref(typeof route.query.status === "string" ? route.query.status : "");
const keyword = ref("");
const regionCode = ref("");

const createOpen = ref(false);
const creating = ref(false);

const importOpen = ref(false);
const importPreview = ref<AdminGymImportPreviewResponse | null>(null);
const previewing = ref(false);
const applying = ref(false);

interface ReasonConfig {
  title: string;
  message?: string;
  danger?: boolean;
  run: (reason: string) => Promise<unknown>;
}
const reasonCfg = ref<ReasonConfig | null>(null);
const reasonOpen = ref(false);
const acting = ref(false);

const columns: AdminColumn[] = [
  { key: "name", label: "암장", width: "1.5fr" },
  { key: "regionCode", label: "지역", width: "120px" },
  { key: "status", label: "상태", width: "100px" },
  { key: "rating", label: "평점", width: "100px" },
  { key: "createdAt", label: "등록일", width: "110px" },
  { key: "actions", label: "", width: "200px", align: "right" },
];

async function load(toPage = page.value) {
  loading.value = true;
  try {
    const { data } = await adminService.searchGyms({
      status: status.value || undefined,
      keyword: keyword.value.trim() || undefined,
      regionCode: regionCode.value.trim() || undefined,
      page: toPage,
      size: 20,
    });
    rows.value = data.content;
    page.value = data.page;
    totalPages.value = data.totalPages;
    totalElements.value = data.totalElements;
  } catch {
    uiStore.showToast("암장 목록을 불러오지 못했어요.", "danger");
  } finally {
    loading.value = false;
  }
}

function search() {
  load(0);
}

async function onCreate(body: AdminGymUpsertRequest) {
  creating.value = true;
  try {
    await adminService.createGym(body);
    createOpen.value = false;
    uiStore.showToast("암장을 생성했어요.", "success");
    await load(0);
  } catch {
    uiStore.showToast("생성에 실패했어요.", "danger");
  } finally {
    creating.value = false;
  }
}

function openImport() {
  importPreview.value = null;
  importOpen.value = true;
}
async function onPreviewImport(rows: AdminGymImportRow[]) {
  previewing.value = true;
  try {
    const { data } = await adminService.previewImport({ rows });
    importPreview.value = data;
  } catch {
    uiStore.showToast("미리보기에 실패했어요.", "danger");
  } finally {
    previewing.value = false;
  }
}
async function onApplyImport(rows: AdminGymImportRow[]) {
  applying.value = true;
  try {
    const { data } = await adminService.applyImport({ rows });
    importOpen.value = false;
    uiStore.showToast(`${data.importedCount}개 암장을 등록했어요.`, "success");
    await load(0);
  } catch {
    uiStore.showToast("등록에 실패했어요. 오류 행을 확인해 주세요.", "danger");
  } finally {
    applying.value = false;
  }
}

function askApprove(gym: AdminGymSearchResponse) {
  reasonCfg.value = { title: `${gym.name} 승인`, message: "이 암장을 운영중(active)으로 승인해요.", run: (reason) => adminService.approveGym(gym.id, { reason: reason || undefined }) };
  reasonOpen.value = true;
}
function askReject(gym: AdminGymSearchResponse) {
  reasonCfg.value = { title: `${gym.name} 반려`, message: "폐쇄(closed) 상태로 반려해요.", danger: true, run: (reason) => adminService.rejectGym(gym.id, { reason: reason || undefined }) };
  reasonOpen.value = true;
}
function askClose(gym: AdminGymSearchResponse) {
  reasonCfg.value = { title: `${gym.name} 폐쇄`, message: "노출을 중단하고 폐쇄 처리해요.", danger: true, run: (reason) => adminService.closeGym(gym.id, { reason: reason || undefined }) };
  reasonOpen.value = true;
}

async function onReasonConfirm(reason: string) {
  if (!reasonCfg.value) return;
  acting.value = true;
  try {
    await reasonCfg.value.run(reason);
    reasonOpen.value = false;
    uiStore.showToast("처리했어요.", "success");
    await load();
  } catch {
    uiStore.showToast("처리에 실패했어요.", "danger");
  } finally {
    acting.value = false;
  }
}

onMounted(() => load(0));
</script>

<template>
  <section class="admin-page">
    <div class="admin-page-head">
      <div>
        <h1 class="admin-page-title">암장</h1>
        <p class="admin-page-sub">암장을 검색·생성하고 승인 상태를 관리해요.</p>
      </div>
      <div class="head-actions">
        <button class="admin-btn" @click="openImport"><AdminIcon name="file-upload" :size="16" /> 일괄 등록</button>
        <button class="admin-btn admin-btn--primary" @click="createOpen = true"><AdminIcon name="plus" :size="16" /> 암장 생성</button>
      </div>
    </div>

    <div class="admin-card">
      <AdminFilterBar v-model:keyword="keyword" keyword-placeholder="암장명 · 주소" @search="search">
        <select v-model="status" class="admin-select" aria-label="상태 필터" @change="search">
          <option value="">전체 상태</option>
          <option v-for="opt in gymStatusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <input v-model="regionCode" class="admin-input region-input" placeholder="지역 코드" aria-label="지역 코드" @keydown.enter="search" />
      </AdminFilterBar>

      <div class="table-wrap">
        <AdminDataTable :columns="columns" :rows="rows" :row-key="(r) => r.id" :loading="loading" clickable empty-text="검색 결과가 없어요." @row-click="(r) => router.push(`/admin/gyms/${r.id}`)">
          <template #cell-name="{ row }">
            <div class="gym-cell">
              <span class="gym-name">{{ row.name }}</span>
              <span class="gym-addr">{{ row.address || "주소 미등록" }}</span>
            </div>
          </template>
          <template #cell-regionCode="{ row }"><span class="muted">{{ row.regionCode || "—" }}</span></template>
          <template #cell-status="{ row }">
            <AdminStatusBadge :label="getGymStatusMeta(row.status).label" :tone="getGymStatusMeta(row.status).tone" />
          </template>
          <template #cell-rating="{ row }">
            <span class="rating"><AdminIcon name="star" :size="14" /> {{ row.ratingAvg != null ? row.ratingAvg.toFixed(1) : "—" }} <span class="muted">({{ row.ratingCount }})</span></span>
          </template>
          <template #cell-createdAt="{ row }"><span class="muted">{{ formatDate(row.createdAt) }}</span></template>
          <template #cell-actions="{ row }">
            <div class="row-actions" @click.stop>
              <button v-if="row.status === 'pending'" class="admin-btn" @click="askApprove(row)">승인</button>
              <button v-if="row.status === 'pending'" class="admin-btn admin-btn--danger" @click="askReject(row)">반려</button>
              <button v-if="row.status === 'active'" class="admin-btn admin-btn--danger" @click="askClose(row)">폐쇄</button>
            </div>
          </template>
        </AdminDataTable>
      </div>

      <AdminPagination :page="page" :total-pages="totalPages" :total-elements="totalElements" @change="load" />
    </div>

    <GymUpsertModal :open="createOpen" :loading="creating" @submit="onCreate" @cancel="createOpen = false" />
    <GymImportModal
      :open="importOpen"
      :preview="importPreview"
      :previewing="previewing"
      :applying="applying"
      @preview="onPreviewImport"
      @apply="onApplyImport"
      @cancel="importOpen = false"
    />
    <AdminReasonDialog
      v-if="reasonCfg"
      :open="reasonOpen"
      :title="reasonCfg.title"
      :message="reasonCfg.message"
      :danger="reasonCfg.danger"
      :loading="acting"
      @confirm="onReasonConfirm"
      @cancel="reasonOpen = false"
    />
  </section>
</template>

<style scoped>
.admin-page {
  max-width: 1120px;
}
.head-actions {
  display: flex;
  gap: 8px;
}
.table-wrap {
  margin-top: 18px;
}
.region-input {
  width: 130px;
}
.gym-cell {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.gym-name {
  font-size: var(--fs-body);
  font-weight: var(--w-semibold);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gym-addr {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.muted {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
}
.rating {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--fs-caption);
  color: var(--hold-orange);
  font-weight: var(--w-semibold);
}
.row-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}
</style>
