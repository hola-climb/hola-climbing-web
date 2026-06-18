<script setup lang="ts">
import { computed } from "vue";
import type { Gym } from "@/types/api";
import { useGymStore } from "@/stores/gym";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { useRouter } from "vue-router";
import HoldPebble from "@/components/common/HoldPebble.vue";
import AppIcon from "@/components/common/AppIcon.vue";

const props = defineProps<{ gym: Gym; selectable?: boolean; source?: string }>();
const emit = defineEmits<{ (e: "select", gym: Gym): void }>();

const gymStore = useGymStore();
const authStore = useAuthStore();
const uiStore = useUIStore();
const router = useRouter();

const holdColors: Array<"pink" | "lime" | "orange" | "cyan"> = ["pink", "lime", "orange", "cyan"];
const holdColor = computed(() => {
  const hash = props.gym.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return holdColors[hash % 4];
});

const isOpen = computed(() => {
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
  const today = days[new Date().getDay()];

  if (props.gym.businessHours) {
    const slot = props.gym.businessHours[today];
    if (!slot) return false;
    const now = new Date();
    const [oh, om] = slot.open.split(":").map(Number);
    const [ch, cm] = slot.close.split(":").map(Number);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return nowMin >= oh * 60 + om && nowMin < ch * 60 + cm;
  }

  if (props.gym.operatingHours) {
    const hours = props.gym.operatingHours[today];
    return !!hours && hours !== "정기 휴무";
  }

  return true;
});

// Show AI BETA for highly-rated gyms
const showAiBeta = computed(() => (props.gym.ratingAvg ?? 0) >= 4.5);

async function handleFavorite(e: Event) {
  e.stopPropagation();
  if (!authStore.isAuthenticated) {
    uiStore.openLoginSheet();
    return;
  }
  try {
    await gymStore.toggleFavorite(props.gym.id);
  } catch {
    uiStore.showToast("즐겨찾기 처리 중 오류가 발생했어요.", "danger");
  }
}

function openDetail() {
  if (props.selectable) {
    emit("select", props.gym);
  } else {
    router.push(`/gyms/${props.gym.id}`);
  }
}
</script>

<template>
  <div class="gym-card hola-card" @click="openDetail" role="button" tabindex="0" :aria-label="gym.name">
    <!-- Hold pebble thumbnail -->
    <div class="thumb">
      <HoldPebble :color="holdColor" :size="40" />
    </div>

    <!-- Gym info -->
    <div class="gym-info">
      <div class="gym-name">{{ gym.name }}</div>
      <div class="gym-sub">
        {{ gym.address.split(" ").slice(0, 2).join(" ") }}
        <template v-if="gym.distanceKm !== null">· {{ gym.distanceKm.toFixed(1) }}km</template>
        <template v-if="gym.ratingAvg">
          ·
          <span class="rating-inline">
            <AppIcon name="star" :size="11" />
            {{ gym.ratingAvg.toFixed(1) }}
          </span>
        </template>
      </div>
      <div class="chip-row">
        <span v-if="source === 'style_match'" class="chip chip-cyan">맞춤</span>
        <span class="chip" :class="isOpen ? 'chip-lime' : 'chip-dark'">
          {{ isOpen ? "OPEN" : "CLOSED" }}
        </span>
        <!-- <span v-if="showAiBeta" class="chip chip-cyan">AI BETA</span> -->
      </div>
    </div>

    <!-- Chevron / favorite -->
    <!-- <button class="fav-btn" @click="handleFavorite" :aria-label="gym.isFavorited ? '즐겨찾기 해제' : '즐겨찾기 추가'"> -->
    <!-- chevron right icon -->
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
      <path d="m9 5 7 7-7 7" />
    </svg>
    <!-- </button> -->
  </div>
</template>

<style scoped>
.gym-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  cursor: pointer;
  transition: transform var(--dur-fast) var(--ease-state);
}
.gym-card:active {
  transform: scale(0.98);
}

.thumb {
  width: 56px;
  height: 56px;
  border-radius: var(--r-button);
  background: var(--surface-soft);
  display: grid;
  place-items: center;
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
}

.gym-info {
  flex: 1;
  min-width: 0;
}
.gym-name {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.005em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gym-sub {
  font-size: 11px;
  color: var(--fg-muted);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rating-inline {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  vertical-align: middle;
}
.chip-row {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: nowrap;
}

.fav-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: var(--fg-muted);
  flex-shrink: 0;
  display: grid;
  place-items: center;
}
</style>
