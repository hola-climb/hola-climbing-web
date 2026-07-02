<script setup lang="ts">
// imports → props/emits → state → computed → methods
import { ref, watch } from "vue";
import { IonModal } from "@ionic/vue";
import type { AdminGymDetail, AdminGymUpsertRequest, AdminBusinessHours } from "@/types/api";
import { normalizeBusinessHours } from "@/utils/adminFormat";
import AdminIcon from "@/components/admin/AdminIcon.vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    /** 수정 대상 (없으면 생성 모드) */
    gym?: AdminGymDetail | null;
    loading?: boolean;
  }>(),
  { gym: null, loading: false },
);

const emit = defineEmits<{
  (e: "submit", body: AdminGymUpsertRequest): void;
  (e: "cancel"): void;
}>();

const DAYS = [
  { key: "mon", backend: "MONDAY", label: "월" },
  { key: "tue", backend: "TUESDAY", label: "화" },
  { key: "wed", backend: "WEDNESDAY", label: "수" },
  { key: "thu", backend: "THURSDAY", label: "목" },
  { key: "fri", backend: "FRIDAY", label: "금" },
  { key: "sat", backend: "SATURDAY", label: "토" },
  { key: "sun", backend: "SUNDAY", label: "일" },
] as const;

interface DayHours {
  enabled: boolean;
  open: string;
  close: string;
}

const form = ref({
  name: "",
  address: "",
  lat: "" as string,
  lng: "" as string,
  phone: "",
  website: "",
  description: "",
  regionCode: "",
});
const hours = ref<Record<string, DayHours>>({});

function resetForm() {
  const g = props.gym;
  form.value = {
    name: g?.name ?? "",
    address: g?.address ?? "",
    lat: g?.lat != null ? String(g.lat) : "",
    lng: g?.lng != null ? String(g.lng) : "",
    phone: g?.phone ?? "",
    website: g?.website ?? "",
    description: g?.description ?? "",
    regionCode: g?.regionCode ?? "",
  };
  const bh = normalizeBusinessHours(g?.businessHours);
  const next: Record<string, DayHours> = {};
  for (const d of DAYS) {
    const slot = bh[d.key];
    next[d.key] = { enabled: !!slot, open: slot?.open ?? "10:00", close: slot?.close ?? "22:00" };
  }
  hours.value = next;
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) resetForm();
  },
);

function buildBusinessHours(): AdminBusinessHours | null {
  const out: AdminBusinessHours = {};
  let hasAny = false;
  for (const d of DAYS) {
    const h = hours.value[d.key];
    if (h?.enabled && h.open && h.close) {
      out[d.backend] = { open: h.open, close: h.close };
      hasAny = true;
    } else {
      out[d.backend] = null;
    }
  }
  return hasAny ? out : null;
}

function onSubmit() {
  if (props.loading || !form.value.name.trim()) return;
  const f = form.value;
  emit("submit", {
    name: f.name.trim(),
    address: f.address.trim() || null,
    lat: f.lat.trim() ? Number(f.lat) : null,
    lng: f.lng.trim() ? Number(f.lng) : null,
    phone: f.phone.trim() || null,
    website: f.website.trim() || null,
    description: f.description.trim() || null,
    businessHours: buildBusinessHours(),
    regionCode: f.regionCode.trim() || null,
  });
}
</script>

<template>
  <IonModal class="gym-modal" :is-open="open" @did-dismiss="emit('cancel')">
    <div class="modal-card">
      <div class="modal-head">
        <h2 class="modal-title">{{ gym ? "암장 수정" : "암장 생성" }}</h2>
        <button class="sheet-close" aria-label="닫기" @click="emit('cancel')"><AdminIcon name="x" /></button>
      </div>

      <div class="modal-body">
        <div class="admin-field">
          <label class="admin-field-label">암장명 *</label>
          <input v-model="form.name" class="admin-input" placeholder="더클라임 강남점" maxlength="100" />
        </div>

        <div class="admin-field">
          <label class="admin-field-label">주소</label>
          <input v-model="form.address" class="admin-input" placeholder="서울 강남구 ..." maxlength="200" />
        </div>

        <div class="grid-2">
          <div class="admin-field">
            <label class="admin-field-label">위도 (lat)</label>
            <input v-model="form.lat" class="admin-input" type="number" step="any" placeholder="37.4979" />
          </div>
          <div class="admin-field">
            <label class="admin-field-label">경도 (lng)</label>
            <input v-model="form.lng" class="admin-input" type="number" step="any" placeholder="127.0276" />
          </div>
        </div>

        <div class="grid-2">
          <div class="admin-field">
            <label class="admin-field-label">전화</label>
            <input v-model="form.phone" class="admin-input" placeholder="02-1234-5678" maxlength="30" />
          </div>
          <div class="admin-field">
            <label class="admin-field-label">지역 코드</label>
            <input v-model="form.regionCode" class="admin-input" placeholder="SEOUL_GANGNAM" maxlength="20" />
          </div>
        </div>

        <div class="admin-field">
          <label class="admin-field-label">웹사이트</label>
          <input v-model="form.website" class="admin-input" placeholder="https://example.com" maxlength="300" />
        </div>

        <div class="admin-field">
          <label class="admin-field-label">소개</label>
          <textarea v-model="form.description" class="admin-textarea" placeholder="암장 소개" />
        </div>

        <div class="admin-field">
          <label class="admin-field-label">운영 시간</label>
          <div class="hours">
            <div v-for="d in DAYS" :key="d.key" class="hour-row">
              <label class="hour-day">
                <input v-model="hours[d.key].enabled" type="checkbox" />
                <span>{{ d.label }}</span>
              </label>
              <template v-if="hours[d.key].enabled">
                <input v-model="hours[d.key].open" class="admin-input hour-time" type="time" />
                <span class="hour-sep">–</span>
                <input v-model="hours[d.key].close" class="admin-input hour-time" type="time" />
              </template>
              <span v-else class="hour-off">휴무</span>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-foot">
        <button class="foot-btn foot-btn--cancel" @click="emit('cancel')">취소</button>
        <button class="foot-btn foot-btn--primary" :disabled="loading || !form.name.trim()" @click="onSubmit">
          {{ gym ? "수정" : "생성" }}
        </button>
      </div>
    </div>
  </IonModal>
</template>

<style scoped>
.gym-modal {
  --width: min(560px, calc(100vw - 48px));
  --height: min(80vh, 720px);
  --border-radius: var(--r-sheet);
  --box-shadow: var(--shadow-float);
}
.modal-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--surface);
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 22px 12px;
}
.modal-title {
  font-size: var(--fs-h3);
  font-weight: var(--w-extrabold);
  letter-spacing: -0.01em;
  margin: 0;
}
.modal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 22px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.hours {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hour-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.hour-day {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: 56px;
  font-size: var(--fs-body);
  font-weight: var(--w-semibold);
  cursor: pointer;
}
.hour-time {
  width: 130px;
}
.hour-sep {
  color: var(--fg-muted);
}
.hour-off {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
}
.modal-foot {
  display: flex;
  gap: 8px;
  padding: 14px 22px;
  border-top: 1px solid var(--border);
}
.foot-btn {
  flex: 1;
  height: 48px;
  border: none;
  border-radius: var(--r-button);
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  font-weight: var(--w-bold);
  cursor: pointer;
}
.foot-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.foot-btn--cancel {
  background: var(--surface-soft);
  color: var(--fg);
}
.foot-btn--primary {
  background: var(--hold-dark);
  color: #fff;
}
</style>
