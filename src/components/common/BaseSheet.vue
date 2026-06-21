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
    하단 잘림 방지의 핵심은 .sheet-body 의 min-height:0 + overflow-y:auto 이며,
    footer 는 항상 화면에 고정되고 safe-area 를 반영한다.
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
}
/* 시트 높이를 꽉 채우는 flex 컬럼 — body 만 스크롤하고 header/footer 는 고정 */
.sheet-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  background: var(--bg);
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
/* 고정 하단 영역 — 액션 버튼이 항상 보이도록 safe-area 까지 패딩 */
.sheet-footer {
  flex-shrink: 0;
  padding: 12px 20px calc(16px + env(safe-area-inset-bottom));
}
.sheet-footer.flush {
  padding-left: 0;
  padding-right: 0;
}
</style>
