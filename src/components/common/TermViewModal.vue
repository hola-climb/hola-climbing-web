<script setup lang="ts">
// imports → props/emits → composables → state → computed → methods
import { IonModal, IonIcon } from "@ionic/vue";
import { closeOutline } from "ionicons/icons";
import type { Term } from "@/types/api";

const props = defineProps<{ term: Term | null }>();
const emit = defineEmits<{ (e: "close"): void }>();

function onClose() {
  emit("close");
}
</script>

<template>
  <IonModal class="term-modal" :is-open="!!term" :initial-breakpoint="0.9" :breakpoints="[0, 0.9]" @did-dismiss="onClose">
    <div v-if="term" class="term-wrap">
      <div class="grabber" aria-hidden="true" />

      <header class="term-head">
        <div class="term-titles">
          <div class="micro-label">{{ term.required ? "필수 약관" : "선택 약관" }}</div>
          <h2 class="term-title">{{ term.title }}</h2>
          <p class="term-version">버전 {{ term.version }}</p>
        </div>
        <button type="button" class="close-btn" aria-label="닫기" @click="onClose">
          <IonIcon :icon="closeOutline" />
        </button>
      </header>

      <div class="term-body">
        <p class="term-content">{{ term.content }}</p>
      </div>
    </div>
  </IonModal>
</template>

<style scoped>
.term-modal {
  --border-radius: var(--r-sheet);
}
.term-wrap {
  height: 100%;
  background: var(--bg);
  padding: 10px 20px calc(20px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
}
.grabber {
  width: 36px;
  height: 4px;
  border-radius: 999px;
  background: var(--border);
  margin: 0 auto 12px;
  flex-shrink: 0;
}
.term-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}
.term-titles {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.micro-label {
  font-size: 10px;
  font-weight: var(--w-semibold);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fg-muted);
}
.term-title {
  font-size: var(--fs-h2);
  font-weight: var(--w-extrabold);
  letter-spacing: -0.01em;
  margin: 0;
}
.term-version {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  margin: 0;
}
.close-btn {
  flex-shrink: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  font-size: 20px;
  color: var(--fg);
  cursor: pointer;
}
.term-body {
  flex: 1;
  overflow-y: auto;
  margin-top: 16px;
  -webkit-overflow-scrolling: touch;
}
.term-content {
  margin: 0;
  font-size: var(--fs-body);
  line-height: 1.6;
  color: var(--fg);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
