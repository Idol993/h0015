import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Patient, Department, Room, WSMessage, DashboardResponse, PatientStatus } from '../types'

export const useQueueStore = defineStore('queue', () => {
  const queue = ref<Patient[]>([])
  const completed = ref<Patient[]>([])
  const departments = ref<Department[]>([])
  const rooms = ref<Room[]>([])
  const preRegistered = ref<Patient[]>([])
  const dashboard = ref<DashboardResponse | null>(null)
  const wsConnected = ref(false)
  const lastCallNumber = ref<Record<string, number>>({})
  const filterDepartment = ref<string>('全部')
  const filterStatus = ref<PatientStatus | '全部'>('全部')

  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  const waitingPatients = computed(() =>
    queue.value.filter(p => p.status === 'waiting')
  )

  const allStatusPatients = computed(() => {
    return [...queue.value, ...completed.value, ...preRegistered.value]
  })

  const filteredPatients = computed(() => {
    return allStatusPatients.value.filter(p => {
      if (filterDepartment.value !== '全部' && p.department !== filterDepartment.value) return false
      if (filterStatus.value !== '全部' && p.status !== filterStatus.value) return false
      return true
    })
  })

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
          queue.value = queue.value.filter(p => !(p.department === dept && p.status === 'waiting'))
          queue.value.push(...newQueue)
        }
        if (message.payload.deptInfo) {
          const idx = departments.value.findIndex(d => d.name === message.payload.deptInfo!.name)
          if (idx >= 0) {
            departments.value[idx] = { ...departments.value[idx], ...message.payload.deptInfo }
          }
          if (message.payload.deptInfo.rooms) {
            const deptRooms = message.payload.deptInfo.rooms
            deptRooms.forEach(r => {
              const ridx = rooms.value.findIndex(rm => rm.id === r.id)
              if (ridx >= 0) {
                rooms.value[ridx] = { ...rooms.value[ridx], ...r }
              } else {
                rooms.value.push(r as Room)
              }
            })
          }
        }
        break
      case 'call_next':
        if (message.payload.patient && message.payload.roomId) {
          lastCallNumber.value[String(message.payload.roomId)] = message.payload.patient.queueNumber
        }
        break
    }
  }

  async function fetchAllData() {
    await Promise.all([
      fetchQueue(),
      fetchCompleted(),
      fetchDepartments(),
      fetchRooms(),
      fetchPreRegistered(),
      fetchDashboard()
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
      }
    } catch (e) {
      console.error('Failed to fetch departments:', e)
    }
  }

  async function fetchRooms() {
    try {
      const res = await fetch('/api/rooms')
      if (res.ok) {
        rooms.value = await res.json()
      }
    } catch (e) {
      console.error('Failed to fetch rooms:', e)
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

  async function fetchDashboard() {
    try {
      const res = await fetch('/api/dashboard')
      if (res.ok) {
        dashboard.value = await res.json()
      }
    } catch (e) {
      console.error('Failed to fetch dashboard:', e)
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

  async function callNext(roomId: number) {
    const res = await fetch('/api/call-next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId })
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
  }

  function getRoomById(roomId: number | string): Room | undefined {
    const id = typeof roomId === 'string' ? parseInt(roomId) : roomId
    return rooms.value.find(r => r.id === id)
  }

  function getRoomsByDepartment(department: string): Room[] {
    const dept = departments.value.find(d => d.name === department)
    if (dept?.rooms) return dept.rooms
    return rooms.value.filter(r => r.departmentName === department)
  }

  function getRoomCurrentPatient(roomId: number | string): Patient | null {
    const room = getRoomById(roomId)
    if (room?.currentPatient) return room.currentPatient as Patient
    return null
  }

  return {
    queue,
    completed,
    departments,
    rooms,
    preRegistered,
    dashboard,
    wsConnected,
    lastCallNumber,
    filterDepartment,
    filterStatus,
    waitingPatients,
    allStatusPatients,
    filteredPatients,
    connectWebSocket,
    disconnectWebSocket,
    fetchAllData,
    fetchQueue,
    fetchCompleted,
    fetchDepartments,
    fetchRooms,
    fetchPreRegistered,
    fetchDashboard,
    createPatient,
    activatePatient,
    callNext,
    markMissed,
    requeuePatient,
    prioritizePatient,
    exportCSV,
    getDepartmentQueue,
    getRoomById,
    getRoomsByDepartment,
    getRoomCurrentPatient
  }
})
