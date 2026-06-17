export interface Patient {
  id: number
  name: string
  phoneLast4: string
  department: string
  appointmentTime?: string
  queueNumber: number
  status: 'waiting' | 'visiting' | 'completed' | 'missed' | 'preregistered'
  priority: boolean
  missedCount: number
  checkInTime?: string
  visitStartTime?: string
  visitEndTime?: string
  waitDuration?: number
  estimatedWait?: number
  estimatedWaitWarn?: boolean
  createdAt: string
  updatedAt: string
}

export interface Department {
  id: number
  name: string
  currentCall: number
  doctorOnDuty: boolean
  avgVisitDuration: number
  waitingCount?: number
  estimatedWait?: number
  visiting?: Patient | null
}

export interface WSMessagePayload {
  department: string
  queue: Patient[]
  deptInfo: Department
  patient?: Patient
}

export interface WSMessage {
  type: 'queue_update' | 'call_next'
  payload: WSMessagePayload
}

export function formatDuration(seconds: number): string {
  if (seconds < 0) seconds = 0
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}小时${minutes}分`
  }
  return `${minutes}分钟`
}

export function maskName(name: string): string {
  if (!name) return ''
  if (name.length <= 1) return name
  if (name.length === 2) return name[0] + '*'
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
}

export function speakQueueNumber(queueNumber: number, name?: string) {
  if ('speechSynthesis' in window) {
    const text = name
      ? `请${name}，${queueNumber}号，到诊室就诊`
      : `请${queueNumber}号患者到诊室就诊`
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = 0.9
    utterance.volume = 1
    window.speechSynthesis.speak(utterance)
  }
}
