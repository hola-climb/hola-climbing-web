<script setup lang="ts">
// imports → composables → state → methods → lifecycle
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { adminService } from "@/services/admin";
import { useUIStore } from "@/stores/ui";
import type { AdminUserSearchResponse } from "@/types/api";
import { userStatusOptions, userRoleOptions, getUserStatusMeta, getUserRoleMeta } from "@/utils/adminLabels";
import { formatDateTime, formatDate } from "@/utils/adminFormat";
import AdminFilterBar from "@/components/admin/AdminFilterBar.vue";
import AdminDataTable, { type AdminColumn } from "@/components/admin/AdminDataTable.vue";
import AdminPagination from "@/components/admin/AdminPagination.vue";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge.vue";
import AdminIcon from "@/components/admin/AdminIcon.vue";

const router = useRouter();
const uiStore = useUIStore();

const rows = ref<AdminUserSearchResponse[]>([]);
const loading = ref(false);
const page = ref(0);
const totalPages = ref(0);
const totalElements = ref(0);

const status = ref("");
const role = ref("");
const keyword = ref("");

const columns: AdminColumn[] = [
  { key: "user", label: "회원", width: "1.4fr" },
  { key: "role", label: "역할", width: "80px" },
  { key: "status", label: "상태", width: "90px" },
  { key: "emailVerified", label: "인증", width: "70px", align: "center" },
  { key: "lastLoginAt", label: "최근 로그인", width: "150px" },
  { key: "createdAt", label: "가입일", width: "110px" },
];

async function load(toPage = page.value) {
  loading.value = true;
  try {
    const { data } = await adminService.searchUsers({
      status: status.value || undefined,
      role: role.value || undefined,
      keyword: keyword.value.trim() || undefined,
      page: toPage,
      size: 20,
    });
    rows.value = data.content;
    page.value = data.page;
    totalPages.value = data.totalPages;
    totalElements.value = data.totalElements;
  } catch {
    uiStore.showToast("회원 목록을 불러오지 못했어요.", "danger");
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
        <h1 class="admin-page-title">회원</h1>
        <p class="admin-page-sub">상태·역할·키워드로 회원을 검색해요.</p>
      </div>
    </div>

    <div class="admin-card">
      <AdminFilterBar v-model:keyword="keyword" keyword-placeholder="이메일 · 닉네임" @search="search">
        <select v-model="status" class="admin-select" aria-label="상태 필터" @change="search">
          <option value="">전체 상태</option>
          <option v-for="opt in userStatusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <select v-model="role" class="admin-select" aria-label="역할 필터" @change="search">
          <option value="">전체 역할</option>
          <option v-for="opt in userRoleOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </AdminFilterBar>

      <div class="table-wrap">
        <AdminDataTable :columns="columns" :rows="rows" :row-key="(r) => r.id" :loading="loading" clickable empty-text="검색 결과가 없어요." @row-click="(r) => router.push(`/admin/users/${r.id}`)">
          <template #cell-user="{ row }">
            <div class="user-cell">
              <span class="user-nick">{{ row.nickname }}</span>
              <span class="user-email">{{ row.email }}</span>
            </div>
          </template>
          <template #cell-role="{ row }">
            <AdminStatusBadge :label="getUserRoleMeta(row.role).label" :tone="getUserRoleMeta(row.role).tone" />
          </template>
          <template #cell-status="{ row }">
            <AdminStatusBadge :label="getUserStatusMeta(row.status).label" :tone="getUserStatusMeta(row.status).tone" />
          </template>
          <template #cell-emailVerified="{ row }">
            <AdminIcon :name="row.emailVerified ? 'check-circle' : 'x-circle'" :class="row.emailVerified ? 'verified' : 'unverified'" :size="18" />
            <span class="sr-only">{{ row.emailVerified ? "인증됨" : "미인증" }}</span>
          </template>
          <template #cell-lastLoginAt="{ row }">
            <span class="muted">{{ formatDateTime(row.lastLoginAt) }}</span>
          </template>
          <template #cell-createdAt="{ row }">
            <span class="muted">{{ formatDate(row.createdAt) }}</span>
          </template>
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
.table-wrap {
  margin-top: 18px;
}
.user-cell {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.user-nick {
  font-size: var(--fs-body);
  font-weight: var(--w-semibold);
  color: var(--fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.user-email {
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
.verified {
  font-size: 18px;
  color: var(--on-tint-lime);
}
.unverified {
  font-size: 18px;
  color: var(--fg-muted);
}
</style>
