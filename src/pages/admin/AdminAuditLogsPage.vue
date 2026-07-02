<script setup lang="ts">
// imports → composables → state → methods → lifecycle
import { ref, onMounted } from "vue";
import { adminService } from "@/services/admin";
import { useUIStore } from "@/stores/ui";
import type { AdminAuditLogResponse } from "@/types/api";
import { getAuditActionLabel } from "@/utils/adminLabels";
import { formatDateTime } from "@/utils/adminFormat";
import AdminFilterBar from "@/components/admin/AdminFilterBar.vue";
import AdminDataTable, { type AdminColumn } from "@/components/admin/AdminDataTable.vue";
import AdminPagination from "@/components/admin/AdminPagination.vue";
import AdminIcon from "@/components/admin/AdminIcon.vue";

const uiStore = useUIStore();

const rows = ref<AdminAuditLogResponse[]>([]);
const loading = ref(false);
const page = ref(0);
const totalPages = ref(0);
const totalElements = ref(0);

const targetType = ref("");
const targetId = ref("");
const adminId = ref("");

const TARGET_TYPES = ["user", "gym", "report", "video", "comment"];

const columns: AdminColumn[] = [
  { key: "createdAt", label: "시각", width: "150px" },
  { key: "action", label: "조치", width: "150px" },
  { key: "target", label: "대상", width: "140px" },
  { key: "adminId", label: "관리자", width: "90px" },
  { key: "reason", label: "사유", width: "1.4fr" },
];

async function load(toPage = page.value) {
  loading.value = true;
  try {
    const { data } = await adminService.getAuditLogs({
      targetType: targetType.value || undefined,
      targetId: targetId.value.trim() ? Number(targetId.value) : undefined,
      adminId: adminId.value.trim() ? Number(adminId.value) : undefined,
      page: toPage,
      size: 20,
    });
    rows.value = data.content;
    page.value = data.page;
    totalPages.value = data.totalPages;
    totalElements.value = data.totalElements;
  } catch {
    uiStore.showToast("감사 로그를 불러오지 못했어요.", "danger");
  } finally {
    loading.value = false;
  }
}

function search() {
  load(0);
}

onMounted(() => load(0));
</script>

<template>
  <section class="admin-page">
    <div class="admin-page-head">
      <div>
        <h1 class="admin-page-title">감사 로그</h1>
        <p class="admin-page-sub">관리자 조치 이력을 대상·관리자별로 조회해요.</p>
      </div>
    </div>

    <div class="admin-card">
      <AdminFilterBar keyword="" :searchable="false">
        <select v-model="targetType" class="admin-select" aria-label="대상 타입" @change="search">
          <option value="">전체 대상</option>
          <option v-for="t in TARGET_TYPES" :key="t" :value="t">{{ t }}</option>
        </select>
        <input v-model="targetId" class="admin-input id-input" type="number" placeholder="대상 ID" aria-label="대상 ID" @keydown.enter="search" />
        <input v-model="adminId" class="admin-input id-input" type="number" placeholder="관리자 ID" aria-label="관리자 ID" @keydown.enter="search" />
        <button class="admin-btn admin-btn--primary search-btn" @click="search"><AdminIcon name="search" :size="16" /> 검색</button>
      </AdminFilterBar>

      <div class="table-wrap">
        <AdminDataTable :columns="columns" :rows="rows" :row-key="(r) => r.id" :loading="loading" empty-text="조회된 로그가 없어요.">
          <template #cell-createdAt="{ row }"><span class="muted">{{ formatDateTime(row.createdAt) }}</span></template>
          <template #cell-action="{ row }"><span class="action-name">{{ getAuditActionLabel(row.action) }}</span></template>
          <template #cell-target="{ row }"><span class="muted">{{ row.targetType }} #{{ row.targetId }}</span></template>
          <template #cell-adminId="{ row }"><span class="muted">#{{ row.adminId }}</span></template>
          <template #cell-reason="{ row }"><span class="reason">{{ row.reason || "—" }}</span></template>
        </AdminDataTable>
      </div>

      <AdminPagination :page="page" :total-pages="totalPages" :total-elements="totalElements" @change="load" />
    </div>
  </section>
</template>

<style scoped>
.admin-page {
  max-width: 1080px;
}
.id-input {
  width: 120px;
}
.search-btn {
  height: 40px;
}
.table-wrap {
  margin-top: 18px;
}
.muted {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
}
.action-name {
  font-weight: var(--w-semibold);
}
.reason {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
