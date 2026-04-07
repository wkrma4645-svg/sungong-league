export interface Season {
  id: string
  name: string
  start_date: string
  end_date: string
  data_start_date: string
  is_active: boolean
}

export interface Tier {
  id: string
  season_id: string
  name: string
  display_name: string
  emoji: string
  min_daily_avg: number
  color_code: string
  sort_order: number
}

export interface Student {
  id: string
  season_id: string
  name: string
  school: string
  grade: number
  daily_goal: number
  join_date: string
  pin_code: string
  parent_phone: string
  is_active: boolean
}

export type InputMethod = 'manual' | 'screenshot' | 'ocr'

export interface DailyRecord {
  id: string
  student_id: string
  record_date: string
  math_hours: number
  english_hours: number
  korean_hours: number
  science_hours: number
  etc_hours: number
  total_hours: number // 자동계산: math + english + korean + science + etc
  screenshot_url: string | null
  input_method: InputMethod
}
