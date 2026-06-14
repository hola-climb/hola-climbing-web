<script setup lang="ts">
// imports → props/emits → composables → methods
import { getCurrentInstance } from "vue";
import { IonHeader, IonToolbar, IonIcon } from "@ionic/vue";
import { chevronBackOutline, closeOutline } from "ionicons/icons";
import { useRouter } from "vue-router";

withDefaults(
  defineProps<{
    title?: string;
    /** show the leading nav button (default true) */
    showBack?: boolean;
    /** leading icon style: "back" (chevron) or "close" (x) */
    backIcon?: "back" | "close";
  }>(),
  { title: "", showBack: true, backIcon: "back" },
);

const emit = defineEmits<{ (e: "back"): void }>();

const router = useRouter();
// Whether the parent bound a @back handler. If so, defer entirely to it.
const hasBackHandler = !!getCurrentInstance()?.vnode.props?.onBack;

function onBack() {
  if (hasBackHandler) emit("back");
  else router.back();
}
</script>

<template>
  <IonHeader class="ion-no-border">
    <IonToolbar>
      <div class="toolbar-inner">
        <button v-if="showBack" class="nav-btn" :aria-label="backIcon === 'close' ? '닫기' : '뒤로'" @click="onBack">
          <IonIcon :icon="backIcon === 'close' ? closeOutline : chevronBackOutline" />
        </button>
        <span v-else class="nav-spacer" />

        <span class="toolbar-title">{{ title }}</span>

        <!-- trailing action slot (right side); spacer keeps title centered when empty -->
        <div class="toolbar-action">
          <slot name="action"><span class="nav-spacer" /></slot>
        </div>
      </div>
    </IonToolbar>
  </IonHeader>
</template>

<style scoped>
.toolbar-inner {
  display: grid;
  grid-template-columns: 44px 1fr 44px;
  align-items: center;
  padding: 0 12px;
  height: 52px;
}
.nav-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--fg);
  font-size: 22px;
  display: grid;
  place-items: center;
  padding: 6px;
}
.nav-spacer {
  display: block;
  width: 44px;
  height: 44px;
}
.toolbar-title {
  text-align: center;
  font-size: var(--fs-h3);
  font-weight: var(--w-semibold);
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.toolbar-action {
  display: grid;
  place-items: center;
  justify-self: end;
}
</style>
