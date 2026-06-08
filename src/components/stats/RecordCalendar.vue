<script setup lang="ts">
import { computed } from "vue";
import type { CalendarDay } from "@/types/api";

const props = defineProps<{
  days: CalendarDay[];
  year: number;
  month: number;
}>();

const dayMap = computed(() => {
  const m: Record<string, CalendarDay> = {};
  props.days.forEach((d) => {
    m[d.date] = d;
  });
  return m;
});

// Build calendar grid
const calendarGrid = computed(() => {
  const firstDay = new Date(props.year, props.month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(props.year, props.month, 0).getDate();
  const grid: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  return grid;
});

function toDateStr(day: number) {
  return `${props.year}-${String(props.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
</script>

<template>
  <div class="calendar hola-card">
    <!-- Day-of-week header -->
    <div class="week-header">
      <span v-for="d in ['일', '월', '화', '수', '목', '금', '토']" :key="d" class="dow">{{ d }}</span>
    </div>

    <!-- Date grid -->
    <div class="date-grid" role="grid" :aria-label="`${year}년 ${month}월 달력`">
      <div v-for="(day, i) in calendarGrid" :key="i" class="date-cell" role="gridcell" :aria-label="day ? `${month}월 ${day}일${dayMap[toDateStr(day)]?.hasRecord ? ', 기록 있음' : ''}` : ''">
        <template v-if="day">
          <span class="date-num" :class="{ today: toDateStr(day) === new Date().toISOString().slice(0, 10) }">
            {{ day }}
          </span>
          <span v-if="dayMap[toDateStr(day)]?.hasRecord" class="record-dot" aria-hidden="true" />
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calendar {
  padding: 16px;
  overflow: visible;
}

.week-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 8px;
}
.dow {
  text-align: center;
  font-size: var(--fs-micro);
  font-weight: var(--w-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-muted);
  padding: 4px 0;
}

.date-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}
.date-cell {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  position: relative;
}
.date-num {
  font-size: 13px;
  font-weight: 500;
  color: var(--fg);
}
.date-num.today {
  background: var(--hold-dark);
  color: #fff;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-weight: 700;
}
.record-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--hold-cyan);
}
</style>
