<script setup lang="ts">
// imports → composables → state → computed → methods
import { ref, computed } from "vue";
import { adminService } from "@/services/admin";
import { useUIStore } from "@/stores/ui";
import type { AdminModelMetricsResponse } from "@/types/api";
import { getTagLabel } from "@/utils/tagLabels";
import { formatPercent } from "@/utils/adminFormat";
import AdminIcon from "@/components/admin/AdminIcon.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import LoadingState from "@/components/common/LoadingState.vue";

const uiStore = useUIStore();

const modelVersion = ref("");
const metrics = ref<AdminModelMetricsResponse | null>(null);
const loading = ref(false);
const searched = ref(false);

const techniqueRows = computed(() => {
  if (!metrics.value) return [];
  return Object.entries(metrics.value.perTechnique).map(([key, m]) => ({ key, label: getTagLabel(key), ...m }));
});

async function search() {
  const v = modelVersion.value.trim();
  if (!v) return;
  loading.value = true;
  searched.value = true;
  try {
    const { data } = await adminService.getModelMetrics(v);
    metrics.value = data;
  } catch {
    metrics.value = null;
    uiStore.showToast("메트릭을 불러오지 못했어요. 모델 버전을 확인해 주세요.", "danger");
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="admin-page">
    <div class="admin-page-head">
      <div>
        <h1 class="admin-page-title">모델 메트릭</h1>
        <p class="admin-page-sub">피드백이 반영된 분석 결과 기준 모델 성능을 조회해요.</p>
      </div>
    </div>

    <div class="admin-card search-card">
      <input
        v-model="modelVersion"
        class="admin-input version-input"
        placeholder="모델 버전 (예: rule_v3+flow_rf_v2)"
        aria-label="모델 버전"
        @keydown.enter="search"
      />
      <button class="admin-btn admin-btn--primary" :disabled="!modelVersion.trim() || loading" @click="search">
        <AdminIcon name="search" :size="16" /> 조회
      </button>
    </div>

    <LoadingState v-if="loading" variant="card" :count="1" />

    <template v-else-if="metrics">
      <div class="summary-grid">
        <div class="sum-card">
          <span class="sum-label">피드백 수</span>
          <span class="sum-value">{{ metrics.feedbackCount.toLocaleString() }}</span>
        </div>
        <div class="sum-card">
          <span class="sum-label">동적/정적 정확도</span>
          <span class="sum-value">{{ formatPercent(metrics.dynamicAccuracy) }}</span>
          <span class="sum-hint">평가 {{ metrics.dynamicEvaluatedCount }}건</span>
        </div>
        <div class="sum-card">
          <span class="sum-label">기술 정확 일치</span>
          <span class="sum-value">{{ formatPercent(metrics.techniqueExactMatchAccuracy) }}</span>
        </div>
      </div>

      <div class="admin-card">
        <h2 class="card-title">기술별 지표 · <span class="model-ver">{{ metrics.modelVersion }}</span></h2>
        <div class="metric-table">
          <div class="mt-head">
            <span>기술</span><span>정확도</span><span>정밀도</span><span>재현율</span><span>F1</span><span>TP/FP/FN/TN</span>
          </div>
          <div v-for="row in techniqueRows" :key="row.key" class="mt-row">
            <span class="mt-tech">{{ row.label }}</span>
            <span>{{ formatPercent(row.accuracy) }}</span>
            <span>{{ formatPercent(row.precision) }}</span>
            <span>{{ formatPercent(row.recall) }}</span>
            <span>{{ formatPercent(row.f1) }}</span>
            <span class="mt-conf">{{ row.truePositive }}/{{ row.falsePositive }}/{{ row.falseNegative }}/{{ row.trueNegative }}</span>
          </div>
        </div>
      </div>
    </template>

    <EmptyState v-else-if="searched" title="결과가 없어요" description="해당 모델 버전의 피드백 데이터가 없거나 버전이 올바르지 않아요." hold="cyan" compact />
    <EmptyState v-else title="모델 버전을 입력해 주세요" description="조회할 분석 모델 버전을 입력하면 성능 지표를 보여드려요." hold="cyan" compact />
  </section>
</template>

<style scoped>
.admin-page {
  max-width: 1000px;
}
.search-card {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 20px;
}
.version-input {
  max-width: 360px;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 16px;
}
.sum-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 18px;
}
.sum-label {
  font-size: var(--fs-micro);
  font-weight: var(--w-semibold);
  letter-spacing: 0.05em;
  color: var(--fg-muted);
}
.sum-value {
  font-size: 28px;
  font-weight: var(--w-extrabold);
  letter-spacing: -0.02em;
  margin-top: 6px;
}
.sum-hint {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
}
.card-title {
  font-size: var(--fs-h3);
  font-weight: var(--w-semibold);
  margin: 0 0 16px;
}
.model-ver {
  font-size: var(--fs-caption);
  font-weight: var(--w-medium);
  color: var(--fg-muted);
  font-family: var(--font-mono, monospace);
}
.metric-table {
  width: 100%;
}
.mt-head,
.mt-row {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr 1fr 1fr 1.4fr;
  gap: 10px;
  align-items: center;
}
.mt-head {
  padding: 0 4px 10px;
  border-bottom: 1px solid var(--border);
  font-size: var(--fs-micro);
  font-weight: var(--w-semibold);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--fg-muted);
}
.mt-row {
  padding: 12px 4px;
  border-bottom: 1px solid var(--border);
  font-size: var(--fs-body);
  font-weight: var(--w-medium);
}
.mt-row:last-child {
  border-bottom: 0;
}
.mt-tech {
  font-weight: var(--w-semibold);
}
.mt-conf {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  font-family: var(--font-mono, monospace);
}
</style>
