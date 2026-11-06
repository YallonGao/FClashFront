export interface Session {
  baseUrl: string
  username: string
  accessToken: string
  refreshToken: string
  deviceKey: string
  deviceId: string
}

export interface Subscription {
  id: string
  name: string
  url: string
  site_url: string
  account: string
  password: string
  note: string
  enabled: boolean
  expire_at: string | null
  traffic_used: number
  traffic_total: number
  created_at: string
  updated_at: string
}

export interface SubscriptionDraft {
  name: string
  url: string
  site_url: string
  account: string
  password: string
  note: string
  enabled: boolean
  expire_at: string | null
  traffic_used: number
  traffic_total: number
}

export interface Device {
  id: string
  key: string
  name: string
  platform: string
  revoked: boolean
  created_at: string
  last_seen_at: string
}
