<script setup lang="ts">
// imports → composables → state → computed → methods → lifecycle
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { adminService } from "@/services/admin";
import { gymService } from "@/services/gym";
import { useUIStore } from "@/stores/ui";
import type { AdminGymDetail, GymGrade, AdminGymUpsertRequest, AdminGymGradeReplaceRequest } from "@/types/api";
import { getGymStatusMeta } from "@/utils/adminLabels";
import { normalizeBusinessHours } from "@/utils/adminFormat";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge.vue";
import AdminReasonDialog from "@/components/admin/AdminReasonDialog.vue";
import GymUpsertModal from "@/components/admin/GymUpsertModal.vue";
import GymGradeModal from "@/components/admin/GymGradeModal.vue";
import AdminIcon from "@/components/admin/AdminIcon.vue";
import LoadingState from "@/components/common/LoadingState.vue";

const route = useRoute();
const router = useRouter();
const uiStore = useUIStore();

const gymId = Number(route.params.id);
const gym = ref<AdminGymDetail | null>(null);
const grades = ref<GymGrade[]>([]);
const loading = ref(true);

const editOpen = ref(false);
const editing = ref(false);
const gradeOpen = ref(false);
const gradeSaving = ref(false);
const uploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

interface ReasonConfig {
  title: string;
  message?: string;
  danger?: boolean;
  run: (reason: string) => Promise<{ data: AdminGymDetail }>;
}
const reasonCfg = ref<ReasonConfig | null>(null);
const reasonOpen = ref(false);
const acting = ref(false);

const DAY_LABELS: Array<{ key: string; label: string }> = [
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
  { key: "sat", label: "토" },
  { key: "sun", label: "일" },
];

const hoursRows = computed(() => {
  const bh = normalizeBusinessHours(gym.value?.businessHours);
  return DAY_LABELS.map((d) => {
    const slot = bh[d.key];
    return { label: d.label, text: slot ? `${slot.open} – ${slot.close}` : "휴무" };
  });
});

async function loadGym() {
  loading.value = true;
  try {
    const { data } = await adminService.getGym(gymId);
    gym.value = data;
  } catch {
    uiStore.showToast("암장 정보를 불러오지 못했어요.", "danger");
  } finally {
    loading.value = false;
  }
  try {
    const { data } = await gymService.getGrades(String(gymId));
    grades.value = data;
  } catch {
    grades.value = [];
  }
}

async function onEdit(body: AdminGymUpsertRequest) {
  editing.value = true;
  try {
    const { data } = await adminService.updateGym(gymId, body);
    gym.value = data;
    editOpen.value = false;
    uiStore.showToast("수정했어요.", "success");
  } catch {
    uiStore.showToast("수정에 실패했어요.", "danger");
  } finally {
    editing.value = false;
  }
}

async function onReplaceGrades(body: AdminGymGradeReplaceRequest) {
  gradeSaving.value = true;
  try {
    const { data } = await adminService.replaceGrades(gymId, body);
    grades.value = data;
    gradeOpen.value = false;
    uiStore.showToast("등급을 교체했어요.", "success");
  } catch {
    uiStore.showToast("등급 교체에 실패했어요.", "danger");
  } finally {
    gradeSaving.value = false;
  }
}

function pickImage() {
  fileInput.value?.click();
}
async function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploading.value = true;
  try {
    const { data } = await adminService.uploadGymImage(gymId, file);
    gym.value = data;
    uiStore.showToast("이미지를 업로드했어요.", "success");
  } catch {
    uiStore.showToast("업로드에 실패했어요. (jpg/png · 5MB 이하)", "danger");
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = "";
  }
}

function askApprove() {
  reasonCfg.value = { title: "암장 승인", message: "운영중(active)으로 승인해요.", run: (r) => adminService.approveGym(gymId, { reason: r || undefined }) };
  reasonOpen.value = true;
}
function askReject() {
  reasonCfg.value = { title: "암장 반려", message: "폐쇄(closed) 상태로 반려해요.", danger: true, run: (r) => adminService.rejectGym(gymId, { reason: r || undefined }) };
  reasonOpen.value = true;
}
function askClose() {
  reasonCfg.value = { title: "암장 폐쇄", message: "노출을 중단하고 폐쇄 처리해요.", danger: true, run: (r) => adminService.closeGym(gymId, { reason: r || undefined }) };
  reasonOpen.value = true;
}
async function onReasonConfirm(reason: string) {
  if (!reasonCfg.value) return;
  acting.value = true;
  try {
    const { data } = await reasonCfg.value.run(reason);
    gym.value = data;
    reasonOpen.value = false;
    uiStore.showToast("처리했어요.", "success");
  } catch {
    uiStore.showToast("처리에 실패했어요.", "danger");
  } finally {
    acting.value = false;
  }
}

onMounted(loadGym);
</script>

<template>
  <section class="admin-page">
    <button class="back" @click="router.push('/admin/gyms')"><AdminIcon name="back" :size="16" /> 암장 목록</button>

    <LoadingState v-if="loading" variant="card" :count="2" />

    <template v-else-if="gym">
      <div class="admin-page-head">
        <div>
          <h1 class="admin-page-title">{{ gym.name }}</h1>
          <p class="admin-page-sub">{{ gym.address || "주소 미등록" }}</p>
        </div>
        <div class="head-actions">
          <AdminStatusBadge :label="getGymStatusMeta(gym.status).label" :tone="getGymStatusMeta(gym.status).tone" />
          <button v-if="gym.status === 'pending'" class="admin-btn" @click="askApprove">승인</button>
          <button v-if="gym.status === 'pending'" class="admin-btn admin-btn--danger" @click="askReject">반려</button>
          <button v-if="gym.status === 'active'" class="admin-btn admin-btn--danger" @click="askClose">폐쇄</button>
          <button class="admin-btn admin-btn--primary" @click="editOpen = true"><AdminIcon name="edit" :size="16" /> 수정</button>
        </div>
      </div>

      <div class="grid">
        <div class="admin-card">
          <div class="thumb-row">
            <div class="thumb" :class="{ 'thumb--empty': !gym.thumbnailUrl }">
              <img v-if="gym.thumbnailUrl" :src="gym.thumbnailUrl" :alt="`${gym.name} 대표 이미지`" />
              <AdminIcon v-else name="photo" :size="28" />
            </div>
            <button class="admin-btn" :disabled="uploading" @click="pickImage">
              <AdminIcon name="upload" :size="16" /> {{ uploading ? "업로드 중…" : "이미지 교체" }}
            </button>
            <input ref="fileInput" type="file" accept="image/jpeg,image/png" class="file-hidden" @change="onFileChange" />
          </div>

          <dl class="info">
            <div><dt>ID</dt><dd>{{ gym.id }}</dd></div>
            <div><dt>좌표</dt><dd>{{ gym.lat != null && gym.lng != null ? `${gym.lat}, ${gym.lng}` : "—" }}</dd></div>
            <div><dt>전화</dt><dd>{{ gym.phone || "—" }}</dd></div>
            <div><dt>웹사이트</dt><dd>{{ gym.website || "—" }}</dd></div>
            <div><dt>지역 코드</dt><dd>{{ gym.regionCode || "—" }}</dd></div>
            <div><dt>평점</dt><dd>{{ gym.ratingAvg != null ? gym.ratingAvg.toFixed(1) : "—" }} ({{ gym.ratingCount }})</dd></div>
            <div class="info-desc"><dt>소개</dt><dd>{{ gym.description || "—" }}</dd></div>
          </dl>
        </div>

        <div class="side">
          <div class="admin-card">
            <h2 class="card-title">운영 시간</h2>
            <div class="hours">
              <div v-for="row in hoursRows" :key="row.label" class="hours-row">
                <span class="hours-day">{{ row.label }}</span>
                <span class="hours-text" :class="{ off: row.text === '휴무' }">{{ row.text }}</span>
              </div>
            </div>
          </div>

          <div class="admin-card">
            <div class="card-head">
              <h2 class="card-title">난이도 등급</h2>
              <button class="admin-btn" @click="gradeOpen = true">교체</button>
            </div>
            <div v-if="grades.length" class="grade-chips">
              <span v-for="g in grades" :key="g.id" class="grade-chip">{{ g.label }}</span>
            </div>
            <p v-else class="empty-line">등록된 등급이 없어요.</p>
          </div>
        </div>
      </div>
    </template>

    <GymUpsertModal :open="editOpen" :gym="gym" :loading="editing" @submit="onEdit" @cancel="editOpen = false" />
    <GymGradeModal :open="gradeOpen" :grades="grades" :loading="gradeSaving" @submit="onReplaceGrades" @cancel="gradeOpen = false" />
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
  max-width: 1000px;
}
.back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 18px;
  border: 0;
  background: transparent;
  color: var(--fg-muted);
  font-size: var(--fs-caption);
  font-weight: var(--w-semibold);
  cursor: pointer;
}
.back:hover {
  color: var(--fg);
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 16px;
  align-items: start;
}
.side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card-title {
  font-size: var(--fs-h3);
  font-weight: var(--w-semibold);
  margin: 0;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.thumb-row {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
}
.thumb {
  width: 88px;
  height: 88px;
  border-radius: 16px;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--surface-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.thumb--empty {
  color: var(--fg-muted);
  font-size: 28px;
}
.file-hidden {
  display: none;
}
.info {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.info div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}
.info dt {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  flex-shrink: 0;
}
.info dd {
  font-size: var(--fs-body);
  font-weight: var(--w-medium);
  margin: 0;
  text-align: right;
  word-break: break-word;
}
.info .info-desc {
  flex-direction: column;
  gap: 4px;
}
.info-desc dd {
  text-align: left;
}
.hours {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 14px;
}
.hours-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--fs-body);
}
.hours-day {
  font-weight: var(--w-semibold);
  color: var(--fg-muted);
}
.hours-text {
  font-weight: var(--w-medium);
}
.hours-text.off {
  color: var(--fg-muted);
}
.grade-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.grade-chip {
  padding: 4px 12px;
  border-radius: var(--r-chip);
  background: var(--surface-soft);
  font-size: var(--fs-caption);
  font-weight: var(--w-semibold);
}
.empty-line {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  margin: 0;
}
</style>
