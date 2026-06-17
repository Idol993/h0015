<template>
  <div class="min-h-screen bg-white flex flex-col items-center justify-between py-12 px-8">
    <header class="w-full max-w-4xl flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-800">{{ currentDepartment }}</h1>
        <p class="text-gray-500 mt-1">诊室叫号系统</p>
      </div>
      <div class="flex items-center gap-3">
        <span class="px-4 py-2 rounded-lg text-sm" :class="wsConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'">
          {{ wsConnected ? '实时同步中' : '连接断开' }}
        </span>
        <router-link to="/reception" class="px-4 py-2 text-gray-500 hover:text-gray-700 transition">
          返回前台
        </router-link>
      </div>
    </header>

    <main class="flex-1 flex flex-col items-center justify-center w-full max-w-4xl">
      <div v-if="currentPatient" class="text-center">
        <div class="text-gray-400 text-lg mb-4">当前就诊</div>
        <div
          :key="currentPatient.queueNumber"
          class="text-[160px] font-bold text-clinic-blue leading-none mb-8"
          :class="{ 'animate-call': showCallAnimation }"
        >
          {{ currentPatient.queueNumber }}
        </div>
        <div class="text-5xl font-semibold text-gray-700">
          {{ currentPatient.name }}
        </div>
        <div v-if="currentPatient.priority" class="mt-4 inline-block px-4 py-1.5 bg-red-100 text-red-600 rounded-full text-lg">
          优先就诊
        </div>
      </div>
      <div v-else class="text-center">
        <div class="text-gray-300 text-[160px] font-bold leading-none mb-8">--</div>
        <div class="text-3xl text-gray-400">暂无就诊患者</div>
        <div class="text-gray-300 mt-2">点击下方"下一位"开始叫号</div>
      </div>

      <div class="mt-16 text-center">
        <div class="text-gray-400 text-sm mb-2">等待中</div>
        <div class="text-5xl font-bold text-gray-300">{{ waitingCount }}</div>
      </div>
    </main>

    <footer class="w-full max-w-4xl">
      <div class="flex items-center justify-center gap-6">
        <button
          @click="handleCallNext"
          :disabled="calling"
          class="px-16 py-5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-2xl font-medium rounded-2xl shadow-lg transition transform hover:scale-[1.02] active:scale-[0.98]"
        >
          {{ calling ? '叫号中...' : '下一位' }}
        </button>
        <button
          v-if="currentPatient"
          @click="handleMissed"
          class="px-8 py-5 bg-yellow-500 hover:bg-yellow-600 text-white text-xl font-medium rounded-2xl shadow-lg transition"
        >
          标记过号
        </button>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useQueueStore } from './stores/queue'
import { speakQueueNumber } from './types'

const route = useRoute()
const store = useQueueStore()

const { departments, wsConnected, connectWebSocket, disconnectWebSocket, getVisitingPatient, getDepartmentQueue, callNext, markMissed } = store

const calling = ref(false)
const showCallAnimation = ref(false)

const currentDepartment = computed(() => {
  const deptId = String(route.params.id)
  const dept = departments.find(d => d.id === Number(deptId) || d.name === deptId)
  return dept?.name || deptId
})

const currentPatient = computed(() => {
  return getVisitingPatient(currentDepartment.value)
})

const waitingCount = computed(() => {
  return getDepartmentQueue(currentDepartment.value).length
})

async function handleCallNext() {
  if (calling.value) return
  calling.value = true
  try {
    const result = await callNext(currentDepartment.value)
    if (result && result.nextPatient) {
      showCallAnimation.value = false
      setTimeout(() => {
        showCallAnimation.value = true
      }, 50)
      speakQueueNumber(result.nextPatient.queueNumber, result.nextPatient.name)
    }
  } catch (e: any) {
    alert(e.message || '叫号失败')
  } finally {
    setTimeout(() => {
      calling.value = false
    }, 1500)
  }
}

async function handleMissed() {
  if (!currentPatient.value) return
  if (!confirm('确认标记当前患者为过号？')) return
  try {
    await markMissed(currentPatient.value.id)
  } catch (e: any) {
    alert(e.message || '操作失败')
  }
}

watch(() => currentPatient.value?.queueNumber, (newVal, oldVal) => {
  if (newVal && newVal !== oldVal) {
    showCallAnimation.value = true
    setTimeout(() => {
      showCallAnimation.value = false
    }, 1500)
  }
})

onMounted(() => {
  connectWebSocket('room', currentDepartment.value)
})

onUnmounted(() => {
  disconnectWebSocket()
})
</script>
