<template>
  <div class="lobby-screen min-h-screen bg-[#111] text-white p-8 overflow-hidden">
    <header class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-4xl font-bold text-white">社区诊所候诊大厅</h1>
        <p class="text-gray-400 mt-2 text-lg">请留意叫号，保持安静</p>
      </div>
      <div class="flex items-center gap-4">
        <div class="text-right">
          <div class="text-3xl font-mono text-white">{{ currentTime }}</div>
          <div class="text-gray-400">{{ currentDate }}</div>
        </div>
        <router-link to="/reception" class="px-4 py-2 text-gray-400 hover:text-white transition">
          返回前台
        </router-link>
      </div>
    </header>

    <div class="lobby-content">
      <div class="lobby-main">
        <div class="grid gap-6" :style="{ gridTemplateColumns: `repeat(${Math.min(departments.length, 2)}, 1fr)` }">
          <div
            v-for="dept in departments"
            :key="dept.id"
            class="bg-[#1a1a1a] rounded-2xl p-8 border border-gray-800"
          >
            <div class="flex items-start justify-between mb-6">
              <div>
                <h2 class="text-2xl font-semibold text-white">{{ dept.name }}</h2>
                <div class="text-gray-400 mt-1">
                  候诊 <span class="text-white font-semibold">{{ dept.waitingCount ?? 0 }}</span> 人
                  · 平均等待 <span class="text-white">{{ formatDuration(dept.estimatedWait ?? 0) }}</span>
                </div>
              </div>
              <span
                class="w-3 h-3 rounded-full mt-2"
                :class="dept.doctorOnDuty ? 'bg-green-500' : 'bg-red-500'"
              ></span>
            </div>

            <div class="text-center py-6 border-t border-b border-gray-800 mb-6">
              <div class="text-gray-400 text-lg mb-4">当前叫号</div>

              <div v-if="hasAnyVisiting(dept)" class="space-y-3 mb-2">
                <div
                  v-for="room in getVisitingRooms(dept)"
                  :key="room.id"
                  class="flex items-center justify-center gap-4"
                >
                  <span class="text-gray-400 text-base">{{ room.name }}：</span>
                  <div
                    :key="room.id + '-' + (room.currentPatient as Patient)?.queueNumber"
                    class="text-[72px] leading-none font-bold text-white"
                    :class="{ 'animate-call': showAnimation[room.id] }"
                  >
                    {{ (room.currentPatient as Patient)?.queueNumber }}
                  </div>
                  <span class="text-2xl text-gray-300">{{ (room.currentPatient as Patient)?.name }}</span>
                </div>
              </div>
              <div v-else>
                <div class="text-[72px] leading-none font-bold text-gray-600 mb-4">--</div>
                <div class="text-gray-400">暂无叫号</div>
              </div>

              <div class="flex justify-center gap-3 mt-4">
                <div
                  v-for="room in dept.rooms"
                  :key="room.id"
                  class="text-xs px-3 py-1 rounded-full"
                  :class="room.currentPatient ? 'bg-blue-900/50 text-blue-300' : 'bg-gray-800 text-gray-500'"
                >
                  {{ room.name }}：{{ room.currentPatient ? (room.currentPatient as Patient).queueNumber + '号' : '空闲' }}
                </div>
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-4">
                <span class="text-gray-400">候诊队列</span>
                <span class="text-gray-500 text-sm">共 {{ getDepartmentQueue(dept.name).length }} 人</span>
              </div>
              <div class="queue-list h-64 overflow-y-auto pr-2">
                <RecycleScroller
                  class="scroller"
                  :items="getDepartmentQueue(dept.name)"
                  :item-size="56"
                  key-field="id"
                  v-slot="{ item, index }"
                >
                  <div class="queue-item flex items-center justify-between py-3 border-b border-gray-800/50">
                    <div class="flex items-center gap-4">
                      <span class="text-2xl font-bold w-16" :class="item.priority ? 'text-red-400' : 'text-[#aaa]'">
                        {{ item.queueNumber }}
                      </span>
                      <span class="text-lg text-[#aaa]">{{ item.name }}</span>
                      <span v-if="item.priority" class="px-2 py-0.5 bg-red-900/50 text-red-300 text-xs rounded-full">优先</span>
                      <span v-if="item.appointmentTime" class="px-2 py-0.5 bg-purple-900/50 text-purple-300 text-xs rounded-full">预约</span>
                    </div>
                    <div class="flex items-center gap-4">
                      <span
                        class="text-sm"
                        :class="getWaitClass(getWaitDuration(item))"
                      >
                        等待 {{ formatDuration(getWaitDuration(item)) }}
                      </span>
                      <span
                        class="text-sm w-28 text-right"
                        :class="item.estimatedWaitWarn ? 'text-yellow-500 font-medium' : 'text-gray-500'"
                      >
                        预计 {{ formatDuration(item.estimatedWait !== undefined ? item.estimatedWait : index * 900) }}
                      </span>
                    </div>
                  </div>
                </RecycleScroller>
                <div
                  v-if="getDepartmentQueue(dept.name).length === 0"
                  class="text-center py-8 text-gray-600"
                >
                  暂无候诊患者
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useQueueStore } from './stores/queue'
import { formatDuration as formatDur } from './types'
import type { Patient, Department, Room } from './types'
import { RecycleScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

const store = useQueueStore()
const { departments, lastCallNumber } = storeToRefs(store)
const { connectWebSocket, disconnectWebSocket, fetchAllData, getDepartmentQueue } = store

const currentTime = ref('')
const currentDate = ref('')
const showAnimation = ref<Record<number, boolean>>({})
let timer: ReturnType<typeof setInterval> | null = null

function formatDuration(seconds: number): string {
  return formatDur(seconds)
}

function getWaitDuration(p: Patient): number {
  if (!p.checkInTime) return p.waitDuration ?? 0
  return Math.floor((Date.now() - new Date(p.checkInTime).getTime()) / 1000)
}

function getWaitClass(seconds: number): string {
  if (seconds >= 3600) return 'text-red-500 font-semibold'
  if (seconds >= 1800) return 'text-yellow-500'
  return 'text-gray-400'
}

function hasAnyVisiting(dept: Department): boolean {
  if (!dept.rooms) return false
  return dept.rooms.some((r: Room) => r.currentPatient)
}

function getVisitingRooms(dept: Department): Room[] {
  if (!dept.rooms) return []
  return dept.rooms.filter((r: Room) => r.currentPatient)
}

function updateTime() {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('zh-CN', { hour12: false })
  currentDate.value = now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })
}

watch(lastCallNumber, (newVal, oldVal) => {
  Object.keys(newVal).forEach(ridStr => {
    const rid = Number(ridStr)
    if (newVal[rid] !== oldVal?.[rid]) {
      showAnimation.value[rid] = true
      setTimeout(() => { showAnimation.value[rid] = false }, 1500)
    }
  })
}, { deep: true })

onMounted(() => {
  fetchAllData()
  connectWebSocket('lobby')
  updateTime()
  timer = setInterval(updateTime, 1000)
})

onUnmounted(() => {
  disconnectWebSocket()
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.lobby-screen {
  background-color: #111;
}

.scroller {
  height: 256px;
}

.queue-list::-webkit-scrollbar {
  width: 6px;
}

.queue-list::-webkit-scrollbar-track {
  background: #222;
}

.queue-list::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 3px;
}

@media (orientation: landscape) and (min-width: 1280px) {
  .lobby-content {
    display: flex;
    gap: 2rem;
  }
}
</style>
