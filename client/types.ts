export interface Patient {
  id: number
  name: string
  phoneLast4: string
  department: string
  appointmentTime?: string
  queueNumber: number
  status: 'waiting' | 'visiting' | 'completed' | 'missed' | 'preregistered'
  priority: boolean
  displayPriority?: boolean
  realPriority?: boolean
  missedCount: number
  roomId?: number
  checkInTime?: string
  visitStartTime?: string
  visitEndTime?: string
  waitDuration?: number
  estimatedWait?: number
  estimatedWaitWarn?: boolean
  createdAt: string
  updatedAt: string
}

export interface Room {
  id: number
  name: string
  departmentId: number
  departmentName: string
  currentPatientId?: number
  currentPatient?: Patient | null
}

export interface Department {
  id: number
  name: string
  doctorOnDuty: boolean
  avgVisitDuration: number
  waitingCount?: number
  estimatedWait?: number
  rooms?: Room[]
}

export interface WSMessagePayload {
  department: string
  queue: Patient[]
  deptInfo: Department
  patient?: Patient
  roomId?: number
  roomName?: string
}

export interface WSMessage {
  type: 'queue_update' | 'call_next'
  payload: WSMessagePayload
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) seconds = 0
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}小时${minutes}分`
  }
  return `${minutes}分钟`
}

export function formatAppointmentTime(timeStr?: string): string {
  if (!timeStr) return ''
  try {
    const d = new Date(timeStr)
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return timeStr
  }
}

export function maskName(name: string): string {
  if (!name) return ''
  if (name.length <= 1) return name
  if (name.length === 2) return name[0] + '*'
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
}

export function speakQueueNumber(queueNumber: number, name?: string, roomName?: string) {
  if ('speechSynthesis' in window) {
    let text = `请${queueNumber}号`
    if (name) text = `${name}，${queueNumber}号`
    if (roomName) text += `，到${roomName}就诊`
    else text += '患者到诊室就诊'
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = 0.9
    utterance.volume = 1
    window.speechSynthesis.speak(utterance)
  }
}
