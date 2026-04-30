export type LogType = 'info' | 'key' | 'success' | 'warning'

export interface LogEntry {
  id: number
  step: number
  message: string
  type: LogType
}

export type Speed = 'slow' | 'normal' | 'fast'

export interface Insight {
  title: string
  body: string
}
