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
  if (props.gym.isOpen !== null && props.gym.isOpen !== undefined) return props.gym.isOpen;
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
  const today = days[new Date().getDay()];
  const bh = props.gym.businessHours;
  if (!bh) return null;
  const slot = bh[today];
  if (!slot) return false;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = slot.open.split(":").map(Number);
  const [ch, cm] = slot.close.split(":").map(Number);
  return nowMin >= oh * 60 + om && nowMin < ch * 60 + cm;
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
    await gymStore.toggleFavorite(props.gym.id, props.gym);
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
        <span v-if="isOpen !== null && gym.businessHours" class="chip" :class="isOpen ? 'chip-lime' : 'chip-dark'">
          {{ isOpen ? "OPEN" : "CLOSED" }}
        </span>
      </div>
    </div>

    <!-- Star favorite icon -->
    <button class="fav-btn" @click="handleFavorite" :aria-label="gym.isFavorited ? '즐겨찾기 해제' : '즐겨찾기'">
      <svg v-if="gym.isFavorited" viewBox="0 0 180 200" width="35" height="35" aria-hidden="true" class="star-icon">
        <defs>
          <radialGradient id="sh" cx="40%" cy="34%" r="72%">
            <stop offset="0%" stop-color="#fff" stop-opacity="0.55"></stop>
            <stop offset="55%" stop-color="#fff" stop-opacity="0"></stop>
          </radialGradient>
        </defs>
        <path
          d="M 89.4 46.4 Q 100.0 20.0 110.6 46.4 L 110.6 46.4 Q 121.2 72.9 149.6 74.8 L 149.6 74.8 Q 178.0 76.7 156.1 94.9 L 156.1 94.9 Q 134.2 113.1 141.2 140.7 L 141.2 140.7 Q 148.2 168.3 124.1 153.2 L 124.1 153.2 Q 100.0 138.0 75.9 153.2 L 75.9 153.2 Q 51.8 168.3 58.8 140.7 L 58.8 140.7 Q 65.8 113.1 43.9 94.9 L 43.9 94.9 Q 22.0 76.7 50.4 74.8 L 50.4 74.8 Q 78.8 72.9 89.4 46.4 Z"
          fill="#22D3EE"
          stroke="#066a78"
          stroke-width="2"
          stroke-opacity="0.18"
          stroke-linejoin="round"
        ></path>
        <path
          d="M 89.4 46.4 Q 100.0 20.0 110.6 46.4 L 110.6 46.4 Q 121.2 72.9 149.6 74.8 L 149.6 74.8 Q 178.0 76.7 156.1 94.9 L 156.1 94.9 Q 134.2 113.1 141.2 140.7 L 141.2 140.7 Q 148.2 168.3 124.1 153.2 L 124.1 153.2 Q 100.0 138.0 75.9 153.2 L 75.9 153.2 Q 51.8 168.3 58.8 140.7 L 58.8 140.7 Q 65.8 113.1 43.9 94.9 L 43.9 94.9 Q 22.0 76.7 50.4 74.8 L 50.4 74.8 Q 78.8 72.9 89.4 46.4 Z"
          fill="url(#sh)"
        ></path>
      </svg>
      <svg v-else viewBox="0 0 200 200" width="30" height="30" aria-hidden="true" class="star-icon">
        <path
          d="M 89.4 46.4 Q 100.0 20.0 110.6 46.4 L 110.6 46.4 Q 121.2 72.9 149.6 74.8 L 149.6 74.8 Q 178.0 76.7 156.1 94.9 L 156.1 94.9 Q 134.2 113.1 141.2 140.7 L 141.2 140.7 Q 148.2 168.3 124.1 153.2 L 124.1 153.2 Q 100.0 138.0 75.9 153.2 L 75.9 153.2 Q 51.8 168.3 58.8 140.7 L 58.8 140.7 Q 65.8 113.1 43.9 94.9 L 43.9 94.9 Q 22.0 76.7 50.4 74.8 L 50.4 74.8 Q 78.8 72.9 89.4 46.4 Z"
          fill="none"
          stroke="#8D96A8"
          stroke-width="8"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <!-- Chevron right -->
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m9 5 7 7-7 7" />
    </svg>
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
