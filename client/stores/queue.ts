import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Patient, Department, WSMessage } from '../types'

export const useQueueStore = defineStore('queue', () => {
  const queue = ref<Patient[]>([])
  const completed = ref<Patient[]>([])
  const departments = ref<Department[]>([])
  const preRegistered = ref<Patient[]>([])
  const currentVisiting = ref<Record<string, Patient | null>>({})
  const wsConnected = ref(false)
  const lastCallNumber = ref<Record<string, number>>({})

  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  const waitingPatients = computed(() =>
    queue.value.filter(p => p.status === 'waiting')
  )

  function connectWebSocket(role: string = 'reception', roomId: string = '') {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/queue?role=${role}&roomId=${roomId}`

    try {
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        wsConnected.value = true
        if (reconnectTimer) {
          clearTimeout(reconnectTimer)
          reconnectTimer = null
        }
        fetchAllData()
      }

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data)
          handleWSMessage(message)
        } catch (e) {
          console.error('Failed to parse WS message:', e)
        }
      }

      ws.onclose = () => {
        wsConnected.value = false
        scheduleReconnect(role, roomId)
      }

      ws.onerror = () => {
        ws?.close()
      }
    } catch (e) {
      console.error('WebSocket connection error:', e)
      scheduleReconnect(role, roomId)
    }
  }

  function scheduleReconnect(role: string, roomId: string) {
    if (reconnectTimer) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connectWebSocket(role, roomId)
    }, 3000)
  }

  function disconnectWebSocket() {
    if (ws) {
      ws.close()
      ws = null
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  function handleWSMessage(message: WSMessage) {
    switch (message.type) {
      case 'queue_update':
        if (message.payload.queue) {
          const dept = message.payload.department
          const newQueue = message.payload.queue
          queue.value = queue.value.filter(p => p.department !== dept || p.status !== 'waiting')
          queue.value.push(...newQueue)
        }
        if (message.payload.deptInfo) {
          const idx = departments.value.findIndex(d => d.name === message.payload.deptInfo!.name)
          if (idx >= 0) {
            departments.value[idx] = { ...departments.value[idx], ...message.payload.deptInfo }
          }
          if (message.payload.deptInfo.visiting) {
            currentVisiting.value[message.payload.department] = message.payload.deptInfo.visiting as Patient
          } else {
            currentVisiting.value[message.payload.department] = null
          }
        }
        break
      case 'call_next':
        if (message.payload.patient) {
          lastCallNumber.value[message.payload.department] = message.payload.patient.queueNumber
        }
        break
    }
  }

  async function fetchAllData() {
    await Promise.all([
      fetchQueue(),
      fetchCompleted(),
      fetchDepartments(),
      fetchPreRegistered()
    ])
  }

  async function fetchQueue(department?: string) {
    try {
      const url = department ? `/api/queue?department=${encodeURIComponent(department)}` : '/api/queue'
      const res = await fetch(url)
      if (res.ok) {
        queue.value = await res.json()
      }
    } catch (e) {
      console.error('Failed to fetch queue:', e)
    }
  }

  async function fetchCompleted() {
    try {
      const res = await fetch('/api/completed')
      if (res.ok) {
        completed.value = await res.json()
      }
    } catch (e) {
      console.error('Failed to fetch completed:', e)
    }
  }

  async function fetchDepartments() {
    try {
      const res = await fetch('/api/departments')
      if (res.ok) {
        departments.value = await res.json()
        departments.value.forEach(d => {
          if (d.visiting) {
            currentVisiting.value[d.name] = d.visiting as Patient
          }
        })
      }
    } catch (e) {
      console.error('Failed to fetch departments:', e)
    }
  }

  async function fetchPreRegistered() {
    try {
      const res = await fetch('/api/preregistered')
      if (res.ok) {
        preRegistered.value = await res.json()
      }
    } catch (e) {
      console.error('Failed to fetch preregistered:', e)
    }
  }

  async function createPatient(data: {
    name: string
    phoneLast4: string
    department: string
    appointmentTime?: string
    priority?: boolean
    preRegistered?: boolean
  }) {
    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || '创建失败')
    }
    const result = await res.json()
    await fetchAllData()
    return result
  }

  async function activatePatient(id: number) {
    const res = await fetch(`/api/patients/${id}/activate`, { method: 'POST' })
    if (!res.ok) throw new Error('激活失败')
    await fetchAllData()
  }

  async function callNext(department: string) {
    const res = await fetch('/api/call-next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ department })
    })
    if (!res.ok) throw new Error('叫号失败')
    const result = await res.json()
    await fetchAllData()
    return result
  }

  async function markMissed(id: number) {
    const res = await fetch(`/api/patients/${id}/missed`, { method: 'POST' })
    if (!res.ok) throw new Error('操作失败')
    await fetchAllData()
  }

  async function requeuePatient(id: number) {
    const res = await fetch(`/api/patients/${id}/requeue`, { method: 'POST' })
    if (!res.ok) throw new Error('操作失败')
    await fetchAllData()
  }

  async function prioritizePatient(id: number) {
    const res = await fetch(`/api/patients/${id}/prioritize`, { method: 'POST' })
    if (!res.ok) throw new Error('操作失败')
    await fetchAllData()
  }

  async function exportCSV() {
    const res = await fetch('/api/export')
    if (!res.ok) throw new Error('导出失败')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `clinic_records_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function getDepartmentQueue(department: string) {
    return queue.value
      .filter(p => p.department === department && p.status === 'waiting')
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority ? -1 : 1
        return a.queueNumber - b.queueNumber
      })
  }

  function getVisitingPatient(department: string) {
    return currentVisiting.value[department] || null
  }

  return {
    queue,
    completed,
    departments,
    preRegistered,
    currentVisiting,
    wsConnected,
    lastCallNumber,
    waitingPatients,
    connectWebSocket,
    disconnectWebSocket,
    fetchAllData,
    fetchQueue,
    fetchCompleted,
    fetchDepartments,
    fetchPreRegistered,
    createPatient,
    activatePatient,
    callNext,
    markMissed,
    requeuePatient,
    prioritizePatient,
    exportCSV,
    getDepartmentQueue,
    getVisitingPatient
  }
})
