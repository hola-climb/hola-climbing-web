<script setup lang="ts">
// imports → props/emits
import { IonModal } from "@ionic/vue";

withDefaults(
  defineProps<{
    /** 열림 상태 */
    open: boolean;
    /** 시트 스냅 지점. 기본값은 닫힘~전체. */
    breakpoints?: number[];
    /** 처음 떠오르는 높이 (breakpoints 중 하나) */
    initialBreakpoint?: number;
    /** 상단 드래그 그래버 표시 */
    grabber?: boolean;
    /** body 좌우 기본 패딩 제거 (풀-블리드 콘텐츠용) */
    flush?: boolean;
  }>(),
  {
    breakpoints: () => [0, 1],
    initialBreakpoint: 1,
    grabber: true,
    flush: false,
  },
);

const emit = defineEmits<{ (e: "close"): void }>();
</script>

<template>
  <!--
    재사용 바텀시트 셸.
    레이아웃: [grabber] → [header(고정)] → [body(스크롤)] → [footer(고정)]
    --height: auto 로 콘텐츠 높이에 맞게 줄어들고, max-height: 90dvh 를 초과하면 body 가 스크롤.
  -->
  <IonModal class="base-sheet" :is-open="open" :handle="false" :initial-breakpoint="initialBreakpoint" :breakpoints="breakpoints" @did-dismiss="emit('close')">
    <div class="sheet-shell">
      <div v-if="grabber" class="sheet-grabber" aria-hidden="true" />

      <div v-if="$slots.header" class="sheet-header">
        <slot name="header" />
      </div>

      <div class="sheet-body" :class="{ flush }">
        <slot />
      </div>

      <div v-if="$slots.footer" class="sheet-footer" :class="{ flush }">
        <slot name="footer" />
      </div>
    </div>
  </IonModal>
</template>

<style scoped>
.base-sheet {
  --border-radius: var(--r-sheet);
  --height: auto;
}
/* 콘텐츠 높이에 맞되, 90dvh 초과 시 body 스크롤 */
.sheet-shell {
  display: flex;
  flex-direction: column;
  max-height: 90dvh;
  min-height: 0;
  background: var(--bg);
  padding-bottom: env(safe-area-inset-bottom);
}
.sheet-grabber {
  flex-shrink: 0;
  width: 36px;
  height: 4px;
  border-radius: 999px;
  background: var(--border);
  margin: 10px auto 4px;
}
.sheet-header {
  flex-shrink: 0;
  padding: 4px 20px 0;
}
/* min-height:0 가 핵심 — 없으면 flex 자식이 콘텐츠보다 작게 줄지 못해 하단이 잘린다 */
.sheet-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 8px 20px;
}
.sheet-body.flush {
  padding-left: 0;
  padding-right: 0;
}
/* 고정 하단 영역 — 액션 버튼이 항상 보이도록 */
.sheet-footer {
  flex-shrink: 0;
  padding: 12px 20px 16px;
}
.sheet-footer.flush {
  padding-left: 0;
  padding-right: 0;
}
</style>
