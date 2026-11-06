import { ref } from 'vue'
import type { Device, Session, Subscription, SubscriptionDraft } from './types'

const SESSION_KEY = 'fclash.session'
const DEVICE_KEY = 'fclash.device'
const SERVER_KEY = 'fclash.server'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(detail)
  }
}

export const session = ref<Session | null>(readSession())

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

function persist(next: Session | null): void {
  session.value = next
  if (next) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(next))
  } else {
    localStorage.removeItem(SESSION_KEY)
  }
}

export function lastServer(): string {
  const saved = localStorage.getItem(SERVER_KEY)
  if (saved) return saved
  // Served by the API itself, the origin is the server; ask for nothing.
  return location.protocol.startsWith('http') ? location.origin : ''
}

export function normalizeBase(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '')
  return trimmed.includes('://') ? trimmed : `http://${trimmed}`
}

// randomUUID only exists in a secure context; a plain-HTTP LAN deployment
// still has to be able to sign in.
function randomKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function deviceKey(): string {
  let key = localStorage.getItem(DEVICE_KEY)
  if (!key) {
    key = randomKey()
    localStorage.setItem(DEVICE_KEY, key)
  }
  return key
}

function deviceName(): string {
  const platform = navigator.platform || 'web'
  return `web · ${platform}`.slice(0, 64)
}

async function toError(response: Response): Promise<ApiError> {
  let detail = `HTTP ${response.status}`
  try {
    const body: unknown = await response.json()
    if (body && typeof body === 'object' && 'detail' in body) {
      const value = (body as { detail: unknown }).detail
      if (typeof value === 'string') detail = value
    }
  } catch {
    // A proxy error page is not JSON; the status is all we have.
  }
  return new ApiError(response.status, detail)
}

async function refresh(): Promise<boolean> {
  const current = session.value
  if (!current) return false
  const response = await fetch(`${current.baseUrl}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: current.refreshToken }),
  })
  if (!response.ok) return false
  const body = (await response.json()) as { access_token: string; refresh_token: string }
  persist({ ...current, accessToken: body.access_token, refreshToken: body.refresh_token })
  return true
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const current = session.value
  if (!current) throw new ApiError(401, 'not_signed_in')

  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('Authorization', `Bearer ${current.accessToken}`)

  const response = await fetch(`${current.baseUrl}${path}`, { ...init, headers })
  if (response.status === 401 && retry) {
    if (await refresh()) return request<T>(path, init, false)
    persist(null)
    throw new ApiError(401, 'session_expired')
  }
  if (!response.ok) throw await toError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

async function authenticate(
  path: 'login' | 'register',
  rawBase: string,
  username: string,
  password: string,
): Promise<void> {
  const baseUrl = normalizeBase(rawBase)
  const response = await fetch(`${baseUrl}/api/v1/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      password,
      device: { key: deviceKey(), name: deviceName(), platform: 'web' },
    }),
  })
  if (!response.ok) throw await toError(response)
  const body = (await response.json()) as {
    user: { username: string }
    device: { id: string }
    tokens: { access_token: string; refresh_token: string }
  }
  localStorage.setItem(SERVER_KEY, baseUrl)
  persist({
    baseUrl,
    username: body.user.username,
    accessToken: body.tokens.access_token,
    refreshToken: body.tokens.refresh_token,
    deviceKey: deviceKey(),
    deviceId: body.device.id,
  })
}

export function login(rawBase: string, username: string, password: string): Promise<void> {
  return authenticate('login', rawBase, username, password)
}

export function register(rawBase: string, username: string, password: string): Promise<void> {
  return authenticate('register', rawBase, username, password)
}

export function signOut(): void {
  persist(null)
}

export function listSubscriptions(): Promise<Subscription[]> {
  return request<Subscription[]>('/api/v1/subscriptions')
}

export function createSubscription(draft: SubscriptionDraft): Promise<Subscription> {
  return request<Subscription>('/api/v1/subscriptions', {
    method: 'POST',
    body: JSON.stringify(draft),
  })
}

export function updateSubscription(
  id: string,
  draft: Partial<SubscriptionDraft>,
): Promise<Subscription> {
  return request<Subscription>(`/api/v1/subscriptions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(draft),
  })
}

export function refreshSubscription(id: string): Promise<Subscription> {
  return request<Subscription>(`/api/v1/subscriptions/${id}/refresh`, { method: 'POST' })
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return request<void>('/api/v1/auth/password', {
    method: 'POST',
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  })
}

export function deleteSubscription(id: string): Promise<void> {
  return request<void>(`/api/v1/subscriptions/${id}`, { method: 'DELETE' })
}

export function listDevices(): Promise<Device[]> {
  return request<Device[]>('/api/v1/devices')
}

export function revokeDevice(id: string): Promise<void> {
  return request<void>(`/api/v1/devices/${id}`, { method: 'DELETE' })
}
