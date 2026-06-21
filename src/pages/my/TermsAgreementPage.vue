<script setup lang="ts">
// imports → composables → state → computed → methods
import { ref, computed, onMounted } from "vue";
import { IonPage, IonContent, IonToggle } from "@ionic/vue";
import AppHeader from "@/components/common/AppHeader.vue";
import LoadingState from "@/components/common/LoadingState.vue";
import BaseButton from "@/components/common/BaseButton.vue";
import TermViewModal from "@/components/common/TermViewModal.vue";
import { authService } from "@/services/auth";
import { useUIStore } from "@/stores/ui";
import type { Term, TermAgreement } from "@/types/api";

const uiStore = useUIStore();

// 동의 현황 목록 (agreed 포함) + 전문 맵(보기용)
const terms = ref<TermAgreement[]>([]);
const contentMap = ref<Record<number, Term>>({});
const isLoading = ref(true);

// 토글 상태 — termId 별 동의 여부. 원본 스냅샷과 비교해 변경 감지.
const agreed = ref<Record<number, boolean>>({});
const original = ref<Record<number, boolean>>({});
const isSaving = ref(false);

// '보기'로 펼친 약관 전문. null 이면 모달 닫힘.
const viewingTerm = ref<Term | null>(null);

// 필수 약관은 동의를 철회할 수 없다(탈퇴로만 가능). 선택만 변경 가능.
const isDirty = computed(() => terms.value.some((t) => !t.required && agreed.value[t.termId] !== original.value[t.termId]));

async function load() {
  isLoading.value = true;
  try {
    const [statusRes, termsRes] = await Promise.all([authService.getAgreementStatus(), authService.getTerms()]);
    terms.value = statusRes.data.terms;
    contentMap.value = Object.fromEntries(termsRes.data.map((t) => [t.termId, t]));
    // 필수는 항상 true 로 잠그고, 선택은 서버 동의 상태로 초기화
    const next: Record<number, boolean> = {};
    for (const t of statusRes.data.terms) next[t.termId] = t.required ? true : t.agreed;
    agreed.value = next;
    original.value = { ...next };
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err);
    uiStore.showToast("약관 동의 현황을 불러오지 못했어요.", "danger");
  } finally {
    isLoading.value = false;
  }
}

function openView(term: TermAgreement) {
  const full = contentMap.value[term.termId];
  if (full) viewingTerm.value = full;
}

async function handleSave() {
  if (!isDirty.value || isSaving.value) return;
  isSaving.value = true;
  try {
    const agreements = terms.value.map((t) => ({ termId: t.termId, agreed: !!agreed.value[t.termId] }));
    await authService.agreeTerms(agreements);
    original.value = { ...agreed.value };
    uiStore.showToast("약관 동의 현황을 저장했어요.");
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err);
    uiStore.showToast("저장에 실패했어요.", "danger");
  } finally {
    isSaving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <IonPage>
    <AppHeader title="약관 동의 현황" />

    <IonContent>
      <div class="terms-content page-padding">
        <LoadingState v-if="isLoading" variant="list" :count="3" label="약관을 불러오는 중" />

        <template v-else>
          <p class="terms-desc">필수 약관은 서비스 이용에 반드시 필요해 철회할 수 없어요. 선택 약관은 언제든 변경할 수 있어요.</p>

          <div class="hola-card term-card">
            <template v-for="(term, i) in terms" :key="term.termId">
              <div v-if="i > 0" class="term-divider" />
              <div class="term-row">
                <div class="term-info">
                  <span class="term-badge" :class="term.required ? 'req' : 'opt'">{{ term.required ? "필수" : "선택" }}</span>
                  <span class="term-title">{{ term.title }}</span>
                </div>
                <div class="term-controls">
                  <button v-if="contentMap[term.termId]" type="button" class="term-view" :aria-label="`${term.title} 약관 보기`" @click="openView(term)">보기</button>
                  <IonToggle
                    v-model="agreed[term.termId]"
                    :disabled="term.required"
                    :aria-label="`${term.title} 동의`"
                    label-placement="start"
                  />
                </div>
              </div>
            </template>
          </div>

          <BaseButton variant="primary" block :loading="isSaving" :disabled="!isDirty" class="save-btn" @click="handleSave">변경사항 저장</BaseButton>
        </template>
      </div>

      <TermViewModal :term="viewingTerm" @close="viewingTerm = null" />
    </IonContent>
  </IonPage>
</template>

<style scoped>
.terms-content {
  padding-top: 20px;
  padding-bottom: 60px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.terms-desc {
  font-size: var(--fs-caption);
  line-height: 1.5;
  color: var(--fg-muted);
  margin: 0 4px;
}

.term-card {
  padding: 0;
}
.term-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
}
.term-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.term-badge {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: var(--w-bold);
  padding: 2px 7px;
  border-radius: 999px;
  letter-spacing: 0.02em;
}
.term-badge.req {
  background: var(--hold-dark);
  color: #fff;
}
.term-badge.opt {
  background: var(--surface-soft);
  color: var(--fg-muted);
}
.term-title {
  font-size: var(--fs-body);
  font-weight: 500;
  color: var(--fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.term-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.term-view {
  background: none;
  border: none;
  padding: 4px 2px;
  font-family: var(--font-sans);
  font-size: var(--fs-caption);
  font-weight: var(--w-semibold);
  color: var(--fg-muted);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
.term-divider {
  height: 1px;
  background: var(--border);
  margin: 0 18px;
}

.save-btn {
  margin-top: 8px;
}
</style>
