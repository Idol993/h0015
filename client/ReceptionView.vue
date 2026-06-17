<template>
  <div class="min-h-screen bg-white flex flex-col">
    <header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
      <div class="flex items-center gap-4">
        <h1 class="text-2xl font-bold text-gray-800">社区诊所 - 前台操作</h1>
        <span class="px-3 py-1 rounded-full text-sm" :class="wsConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'">
          {{ wsConnected ? '已连接' : '连接断开' }}
        </span>
      </div>
      <div class="flex items-center gap-3">
        <router-link to="/lobby" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition">
          查看候诊屏
        </router-link>
        <button @click="handleExport" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">
          导出今日记录
        </button>
      </div>
    </header>

    <div class="flex-1 flex overflow-hidden">
      <div class="w-80 border-r border-gray-200 p-4 overflow-y-auto flex flex-col gap-4">
        <div class="bg-gray-50 rounded-xl p-4">
          <h2 class="text-lg font-semibold text-gray-800 mb-4">新患者签到 / 预约</h2>
          <form @submit.prevent="handleCreatePatient" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">姓名</label>
              <input
                v-model="form.name"
                type="text"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="请输入姓名"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">手机号后4位</label>
              <input
                v-model="form.phoneLast4"
                type="text"
                maxlength="4"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="如 1234"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">就诊科室</label>
              <select
                v-model="form.department"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="">请选择科室</option>
                <option v-for="d in departments" :key="d.id" :value="d.name">{{ d.name }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                预约时间
                <span class="text-gray-400 font-normal ml-1">（选填，仅电话预约时填写）</span>
              </label>
              <input
                v-model="form.appointmentTime"
                type="datetime-local"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div class="flex items-center gap-2">
              <input v-model="form.priority" type="checkbox" id="priority" class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <label for="priority" class="text-sm text-gray-700">优先就诊（老人/孕妇）</label>
            </div>
            <div class="flex items-center gap-2">
              <input v-model="form.preRegistered" type="checkbox" id="prereg" class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <label for="prereg" class="text-sm text-gray-700">暂不入队（仅录入预约）</label>
            </div>
            <button
              type="submit"
              class="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition shadow-sm"
            >
              {{ form.preRegistered ? '录入预约' : '签到排号' }}
            </button>
          </form>
        </div>

        <div class="bg-gray-50 rounded-xl p-4">
          <h2 class="text-lg font-semibold text-gray-800 mb-3">电话预约待激活</h2>
          <div v-if="sortedPreRegistered.length === 0" class="text-gray-400 text-sm text-center py-4">
            暂无预约患者
          </div>
          <div v-else class="space-y-2 max-h-64 overflow-y-auto">
            <div
              v-for="p in sortedPreRegistered"
              :key="p.id"
              class="bg-white rounded-lg p-3 border flex items-center justify-between"
              :class="isAppointmentNear(p) ? 'border-blue-300 bg-blue-50' : 'border-gray-200'"
            >
              <div class="flex-1 min-w-0">
                <div class="font-medium text-gray-800 flex items-center gap-2">
                  {{ p.name }}
                  <span v-if="isAppointmentNear(p)" class="px-1.5 py-0.5 bg-blue-500 text-white text-[10px] rounded">临近</span>
                  <span v-if="p.priority" class="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] rounded">优先</span>
                </div>
                <div class="text-xs text-gray-500 mt-0.5">{{ p.department }} · {{ p.phoneLast4 || '无手机' }}</div>
                <div v-if="p.appointmentTime" class="text-xs text-blue-600 mt-1">
                  预约：{{ formatAppointmentTime(p.appointmentTime) }}
                </div>
              </div>
              <button
                @click="handleActivate(p.id)"
                class="ml-2 px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition shrink-0"
              >
                激活
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="flex-1 flex flex-col overflow-hidden">
        <div class="px-6 py-3 border-b border-gray-200 bg-gray-50">
          <div class="flex items-center gap-4">
            <label class="text-sm font-medium text-gray-700">筛选科室：</label>
            <select
              v-model="filterDept"
              class="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            >
              <option value="">全部科室</option>
              <option v-for="d in departments" :key="d.id" :value="d.name">{{ d.name }}</option>
            </select>
            <span class="text-sm text-gray-500">
              当前候诊 <span class="font-semibold text-blue-600">{{ filteredQueue.length }}</span> 人
            </span>
          </div>
        </div>

        <div class="flex-1 overflow-auto">
          <table class="w-full">
            <thead class="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">排队号</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">患者信息</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">科室</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">已等待</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">预计等待</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">状态</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr
                v-for="p in filteredQueue"
                :key="p.id"
                :class="getRowClass(p)"
              >
                <td class="px-4 py-3">
                  <span class="text-2xl font-bold text-clinic-blue">{{ p.queueNumber }}</span>
                  <span v-if="p.priority" class="ml-2 px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">优先</span>
                  <span v-if="p.appointmentTime && p.status === 'waiting'" class="ml-1 px-2 py-0.5 bg-purple-100 text-purple-600 text-xs rounded-full">
                    预约 {{ formatAppointmentTime(p.appointmentTime) }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <div class="font-medium text-gray-800">{{ p.name }}</div>
                  <div v-if="p.phoneLast4" class="text-xs text-gray-500">{{ p.phoneLast4 }}</div>
                </td>
                <td class="px-4 py-3 text-gray-700">{{ p.department }}</td>
                <td class="px-4 py-3">
                  <span :class="getWaitDurationClass(getWaitDuration(p))">
                    {{ formatDuration(getWaitDuration(p)) }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <span :class="p.estimatedWaitWarn ? 'text-yellow-600 font-medium' : 'text-gray-600'">
                    {{ p.estimatedWait !== undefined ? formatDuration(p.estimatedWait) : '-' }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <span :class="getStatusClass(p.status)">{{ getStatusText(p.status) }}</span>
                </td>
                <td class="px-4 py-3">
                  <div class="flex gap-2">
                    <button
                      v-if="p.status === 'waiting' && !(p.realPriority ?? p.priority)"
                      @click="handlePrioritize(p.id)"
                      class="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded transition"
                    >
                      置顶
                    </button>
                    <button
                      v-if="p.status === 'visiting'"
                      @click="handleMissed(p.id)"
                      class="px-2 py-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs rounded transition"
                    >
                      标记过号
                    </button>
                    <button
                      v-if="p.status === 'missed'"
                      @click="handleRequeue(p.id)"
                      class="px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded transition"
                    >
                      重新入队
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredQueue.length === 0">
                <td colspan="7" class="px-4 py-12 text-center text-gray-400">暂无候诊患者</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="w-72 border-l border-gray-200 p-4 overflow-y-auto flex flex-col gap-4">
        <div class="bg-gray-50 rounded-xl p-4">
          <h2 class="text-lg font-semibold text-gray-800 mb-3">最近完成</h2>
          <div v-if="completed.length === 0" class="text-gray-400 text-sm text-center py-4">
            暂无记录
          </div>
          <div v-else class="space-y-2 max-h-96 overflow-y-auto">
            <div
              v-for="p in completed"
              :key="p.id"
              :class="['bg-white rounded-lg p-3 border', p.status === 'missed' ? 'border-red-200 bg-red-50' : 'border-gray-200']"
            >
              <div class="flex items-center justify-between">
                <span class="text-lg font-bold text-clinic-blue">{{ p.queueNumber }}号</span>
                <span :class="getStatusClass(p.status)" class="text-xs px-2 py-0.5 rounded-full">{{ getStatusText(p.status) }}</span>
              </div>
              <div class="text-sm text-gray-600 mt-1">{{ p.name }} · {{ p.department }}</div>
              <div v-if="p.missedCount > 0" class="text-xs text-red-500 mt-1">过号 {{ p.missedCount }} 次</div>
              <button
                v-if="p.status === 'missed'"
                @click="handleRequeue(p.id)"
                class="mt-2 w-full px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition"
              >
                重新入队（队尾+新号）
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <footer class="border-t border-gray-200 bg-gray-50 px-6 py-3">
      <div class="flex items-start gap-6 flex-wrap">
        <div
          v-for="d in departments"
          :key="d.id"
          class="bg-white px-4 py-3 rounded-lg shadow-sm border border-gray-200 min-w-[260px]"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="font-semibold text-gray-800">{{ d.name }}</span>
            <span
              class="w-2.5 h-2.5 rounded-full"
              :class="d.doctorOnDuty ? 'bg-green-500' : 'bg-red-500'"
            ></span>
          </div>
          <div class="text-sm text-gray-500 mb-2">
            候诊 <span class="font-bold text-clinic-blue text-base">{{ d.waitingCount ?? 0 }}</span> 人
            · 平均等待 <span class="text-gray-700 font-medium">{{ formatDuration(d.estimatedWait ?? 0) }}</span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <div
              v-for="r in d.rooms"
              :key="r.id"
              class="text-xs px-2 py-1 rounded-md bg-gray-100 flex items-center gap-1"
              :class="r.currentPatient ? 'bg-blue-50 border border-blue-200' : ''"
            >
              <span class="text-gray-500">{{ r.name }}</span>
              <span v-if="r.currentPatient" class="font-bold text-clinic-blue">
                {{ (r.currentPatient as Patient).queueNumber }}号
              </span>
              <span v-else class="text-gray-400">空闲</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useQueueStore } from './stores/queue'
import { formatDuration as formatDur, speakQueueNumber, maskName, formatAppointmentTime as fmtAppt } from './types'
import type { Patient } from './types'

const store = useQueueStore()
const { queue, completed, departments, preRegistered, wsConnected } = storeToRefs(store)
const {
  connectWebSocket, disconnectWebSocket, fetchAllData,
  createPatient, activatePatient, prioritizePatient, markMissed, requeuePatient, exportCSV
} = store

const form = ref({
  name: '',
  phoneLast4: '',
  department: '',
  appointmentTime: '',
  priority: false,
  preRegistered: false
})

const filterDept = ref('')
const tickTimer = ref<ReturnType<typeof setInterval> | null>(null)

const sortedPreRegistered = computed(() => {
  return [...preRegistered.value].sort((a, b) => {
    if (a.appointmentTime && b.appointmentTime) {
      return new Date(a.appointmentTime).getTime() - new Date(b.appointmentTime).getTime()
    }
    if (a.appointmentTime) return -1
    if (b.appointmentTime) return 1
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
})

const filteredQueue = computed(() => {
  let result = queue.value.filter(p => p.status === 'waiting' || p.status === 'visiting')
  if (filterDept.value) {
    result = result.filter(p => p.department === filterDept.value)
  }
  return result.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'visiting' ? -1 : 1
    }
    if ((a.realPriority ?? a.priority) !== (b.realPriority ?? b.priority)) {
      return (a.realPriority ?? a.priority) ? -1 : 1
    }
    if (a.appointmentTime && b.appointmentTime) {
      return new Date(a.appointmentTime).getTime() - new Date(b.appointmentTime).getTime()
    }
    if (a.appointmentTime) return -1
    if (b.appointmentTime) return 1
    return a.queueNumber - b.queueNumber
  })
})

function formatDuration(seconds: number) {
  return formatDur(seconds)
}

function formatAppointmentTime(t?: string) {
  return fmtAppt(t)
}

function isAppointmentNear(p: Patient): boolean {
  if (!p.appointmentTime) return false
  const diff = new Date(p.appointmentTime).getTime() - Date.now()
  return diff < 30 * 60 * 1000
}

function getWaitDuration(p: Patient): number {
  if (!p.checkInTime) return p.waitDuration ?? 0
  return Math.floor((Date.now() - new Date(p.checkInTime).getTime()) / 1000)
}

function getWaitDurationClass(seconds: number): string {
  if (seconds >= 3600) return 'text-red-600 font-semibold'
  if (seconds >= 1800) return 'text-yellow-600 font-medium'
  return 'text-gray-600'
}

function getRowClass(p: Patient): string {
  if (p.status === 'missed') return 'bg-red-50'
  if (p.status === 'visiting') return 'bg-blue-50'
  return ''
}

function getStatusClass(status: string): string {
  const map: Record<string, string> = {
    waiting: 'bg-blue-100 text-blue-700',
    visiting: 'bg-green-100 text-green-700',
    completed: 'bg-gray-100 text-gray-700',
    missed: 'bg-red-100 text-red-700',
    preregistered: 'bg-purple-100 text-purple-700'
  }
  return `px-2 py-1 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-700'}`
}

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    waiting: '候诊',
    visiting: '就诊中',
    completed: '已完成',
    missed: '已过号',
    preregistered: '已预约'
  }
  return map[status] || status
}

async function handleCreatePatient() {
  try {
    const payload: any = {
      name: form.value.name,
      phoneLast4: form.value.phoneLast4,
      department: form.value.department,
      priority: form.value.priority,
      preRegistered: form.value.preRegistered
    }
    if (form.value.appointmentTime) {
      payload.appointmentTime = new Date(form.value.appointmentTime).toISOString()
    }
    const result = await createPatient(payload)

    if (!form.value.preRegistered) {
      speakQueueNumber(result.queueNumber, maskName(form.value.name))
    }

    form.value = {
      name: '',
      phoneLast4: '',
      department: '',
      appointmentTime: '',
      priority: false,
      preRegistered: false
    }
  } catch (e: any) {
    alert(e.message || '操作失败')
  }
}

async function handleActivate(id: number) {
  try {
    await activatePatient(id)
  } catch (e: any) {
    alert(e.message || '激活失败')
  }
}

async function handlePrioritize(id: number) {
  try {
    await prioritizePatient(id)
  } catch (e: any) {
    alert(e.message || '操作失败')
  }
}

async function handleMissed(id: number) {
  if (!confirm('确认标记为过号？')) return
  try {
    await markMissed(id)
  } catch (e: any) {
    alert(e.message || '操作失败')
  }
}

async function handleRequeue(id: number) {
  if (!confirm('重新入队将分配新排队号并排到队尾，确认？')) return
  try {
    await requeuePatient(id)
  } catch (e: any) {
    alert(e.message || '操作失败')
  }
}

async function handleExport() {
  try {
    await exportCSV()
  } catch (e: any) {
    alert(e.message || '导出失败')
  }
}

onMounted(() => {
  fetchAllData()
  connectWebSocket('reception')
  tickTimer.value = setInterval(() => {}, 1000)
})

onUnmounted(() => {
  disconnectWebSocket()
  if (tickTimer.value) {
    clearInterval(tickTimer.value)
  }
})
</script>
