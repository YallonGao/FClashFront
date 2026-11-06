<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useDialog, useMessage } from 'naive-ui'
import AppShell from '../layout/AppShell.vue'
import {
  ApiError,
  createSubscription,
  deleteSubscription,
  listSubscriptions,
  previewSubscription,
  refreshSubscription,
  updateSubscription,
} from '../api/client'
import type { Subscription } from '../api/types'

const GIB = 1024 ** 3
const DAY = 86_400_000

const message = useMessage()
const dialog = useDialog()

const items = ref<Subscription[]>([])
const loading = ref(false)
const saving = ref(false)
const editorOpen = ref(false)
const editingId = ref<string | null>(null)
const revealed = ref<Record<string, boolean>>({})
const refreshing = ref<Record<string, boolean>>({})
const importUrl = ref('')
const importing = ref(false)
const query = ref('')
const statusFilter = ref<'all' | 'ok' | 'expiring' | 'expired' | 'off'>('all')
const sortBy = ref<'added' | 'expiry' | 'name'>('added')

const statusOptions = [
  { label: '全部', value: 'all' },
  { label: '正常', value: 'ok' },
  { label: '7 天内到期', value: 'expiring' },
  { label: '已过期', value: 'expired' },
  { label: '已停用', value: 'off' },
]

const sortOptions = [
  { label: '最近添加', value: 'added' },
  { label: '到期最近', value: 'expiry' },
  { label: '名称', value: 'name' },
]

const form = reactive({
  name: '',
  url: '',
  site_url: '',
  account: '',
  password: '',
  note: '',
  enabled: true,
  expireAt: null as number | null,
  usedGb: 0,
  totalGb: 0,
})

const stats = computed(() => {
  return {
    total: items.value.length,
    active: items.value.filter((item) => item.enabled).length,
    expiring: items.value.filter((item) => {
      const left = daysLeft(item)
      return left !== null && left >= 0 && left <= 7
    }).length,
    expired: items.value.filter((item) => {
      const left = daysLeft(item)
      return left !== null && left < 0
    }).length,
  }
})

const visible = computed(() => {
  const needle = query.value.trim().toLowerCase()
  const rows = items.value.filter((item) => {
    if (needle) {
      const haystack = `${item.name} ${item.site_url} ${item.account} ${item.note}`.toLowerCase()
      if (!haystack.includes(needle)) return false
    }
    const left = daysLeft(item)
    switch (statusFilter.value) {
      case 'off':
        return !item.enabled
      case 'expired':
        return left !== null && left < 0
      case 'expiring':
        return left !== null && left >= 0 && left <= 7
      case 'ok':
        return item.enabled && (left === null || left > 7)
      default:
        return true
    }
  })
  return [...rows].sort((a, b) => {
    if (sortBy.value === 'name') return a.name.localeCompare(b.name, 'zh-CN')
    if (sortBy.value === 'expiry') {
      const av = a.expire_at ? new Date(a.expire_at).getTime() : Number.MAX_SAFE_INTEGER
      const bv = b.expire_at ? new Date(b.expire_at).getTime() : Number.MAX_SAFE_INTEGER
      return av - bv
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
})

async function refreshOne(item: Subscription): Promise<void> {
  refreshing.value = { ...refreshing.value, [item.id]: true }
  try {
    const updated = await refreshSubscription(item.id)
    items.value = items.value.map((row) => (row.id === updated.id ? updated : row))
    message.success('已同步机场数据')
  } catch (error) {
    const detail = error instanceof ApiError ? error.detail : ''
    message.error(refreshMessage(detail))
  } finally {
    const next = { ...refreshing.value }
    delete next[item.id]
    refreshing.value = next
  }
}

function refreshMessage(detail: string): string {
  switch (detail) {
    case 'no_url':
      return '这条订阅没有填链接'
    case 'blocked_address':
      return '链接指向内网地址，服务器拒绝访问'
    case 'no_userinfo':
      return '机场没有返回流量信息'
    case 'unresolvable_host':
      return '域名解析不了'
    case 'fetch_failed':
      return '连不上机场服务器'
    default:
      return detail ? `刷新失败（${detail}）` : '刷新失败'
  }
}

function humanize(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.detail === 'session_expired') {
      return '登录已过期，请重新登录'
    }
    if (error.detail === 'subscription_not_found') {
      return '订阅不存在，可能已在别处删除'
    }
    return `请求失败（${error.status}）`
  }
  return '网络不可达，请检查服务器'
}

async function load(): Promise<void> {
  loading.value = true
  try {
    items.value = await listSubscriptions()
  } catch (error) {
    message.error(humanize(error))
  } finally {
    loading.value = false
  }
}

async function importFromLink(): Promise<void> {
  const url = (importUrl.value || form.url).trim()
  if (!url) {
    message.warning('先粘贴订阅链接')
    return
  }
  importing.value = true
  try {
    const preview = await previewSubscription(url)
    form.url = url
    if (preview.name) form.name = preview.name
    if (preview.site_url) form.site_url = preview.site_url
    if (preview.traffic_total) {
      form.usedGb = Number((preview.traffic_used / GIB).toFixed(2))
      form.totalGb = Number((preview.traffic_total / GIB).toFixed(2))
    }
    if (preview.expire_at) {
      form.expireAt = toLocalMidnight(preview.expire_at)
    }
    message.success('已从链接读取')
  } catch (error) {
    const detail = error instanceof ApiError ? error.detail : ''
    message.error(previewMessage(detail))
  } finally {
    importing.value = false
  }
}

function previewMessage(detail: string): string {
  switch (detail) {
    case 'invalid_url':
      return '链接格式不对，需要 http:// 或 https:// 开头'
    case 'blocked_address':
      return '链接指向内网地址，服务器拒绝访问'
    case 'unresolvable_host':
      return '域名解析不了'
    case 'fetch_failed':
      return '连不上机场服务器'
    default:
      return detail ? `读取失败（${detail}）` : '读取失败'
  }
}

function openCreate(): void {
  editingId.value = null
  Object.assign(form, {
    name: '',
    url: '',
    site_url: '',
    account: '',
    password: '',
    note: '',
    enabled: true,
    expireAt: null,
    usedGb: 0,
    totalGb: 0,
  })
  editorOpen.value = true
}

function openEdit(item: Subscription): void {
  editingId.value = item.id
  Object.assign(form, {
    name: item.name,
    url: item.url,
    site_url: item.site_url,
    account: item.account,
    password: item.password,
    note: item.note,
    enabled: item.enabled,
    expireAt: item.expire_at ? toLocalMidnight(item.expire_at) : null,
    usedGb: Number((item.traffic_used / GIB).toFixed(2)),
    totalGb: Number((item.traffic_total / GIB).toFixed(2)),
  })
  editorOpen.value = true
}

async function save(): Promise<void> {
  if (!form.name.trim()) {
    message.warning('订阅名称不能为空')
    return
  }
  const draft = {
    name: form.name.trim(),
    url: form.url.trim(),
    site_url: form.site_url.trim(),
    account: form.account.trim(),
    password: form.password,
    note: form.note.trim(),
    enabled: form.enabled,
    expire_at: form.expireAt ? utcDay(form.expireAt).toISOString() : null,
    traffic_used: Math.round(form.usedGb * GIB),
    traffic_total: Math.round(form.totalGb * GIB),
  }
  saving.value = true
  try {
    if (editingId.value) {
      await updateSubscription(editingId.value, draft)
    } else {
      await createSubscription(draft)
    }
    editorOpen.value = false
    await load()
    message.success('已保存')
  } catch (error) {
    message.error(humanize(error))
  } finally {
    saving.value = false
  }
}

function remove(item: Subscription): void {
  dialog.warning({
    title: '删除订阅',
    content: `确定删除「${item.name}」？服务器上的记录会一并删除。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await deleteSubscription(item.id)
        await load()
        message.success('已删除')
      } catch (error) {
        message.error(humanize(error))
      }
    },
  })
}

async function copy(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    message.success(`${label}已复制`)
  } catch {
    message.error('浏览器拒绝了剪贴板访问')
  }
}

function openSite(url: string): void {
  const target = /^https?:\/\//i.test(url) ? url : `https://${url}`
  window.open(target, '_blank', 'noopener')
}

function toggle(id: string): void {
  revealed.value = { ...revealed.value, [id]: !revealed.value[id] }
}

function statusOf(item: Subscription): { label: string; type: 'success' | 'warning' | 'error' | 'default' } {
  if (!item.enabled) return { label: '已停用', type: 'default' }
  const left = daysLeft(item)
  if (left === null) return { label: '正常', type: 'success' }
  if (left < 0) return { label: '已过期', type: 'error' }
  if (left <= 7) return { label: '即将到期', type: 'warning' }
  return { label: '正常', type: 'success' }
}

/// Expiry is a calendar date, not an instant: store and render it as UTC
/// midnight so the same subscription does not switch days across time zones.
function utcDay(value: number): Date {
  const local = new Date(value)
  return new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()))
}

function todayUtc(): number {
  const now = new Date()
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
}

function daysLeft(item: Subscription): number | null {
  if (!item.expire_at) return null
  const target = new Date(item.expire_at)
  const day = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate())
  return Math.round((day - todayUtc()) / DAY)
}

function toLocalMidnight(iso: string): number {
  const date = new Date(iso)
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()).getTime()
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
    date.getUTCDate(),
  ).padStart(2, '0')}`
}

function daysText(item: Subscription): string {
  const days = daysLeft(item)
  if (days === null) return ''
  return days >= 0 ? `剩 ${days} 天` : `已过期 ${-days} 天`
}

function formatTraffic(bytes: number): string {
  if (!bytes) return '0'
  const gib = bytes / GIB
  if (gib >= 1) return `${gib.toFixed(1)} GB`
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
}

function trafficPercent(item: Subscription): number {
  if (!item.traffic_total) return 0
  return Math.min(100, Math.round((item.traffic_used / item.traffic_total) * 100))
}

function shortHost(url: string): string {
  if (!url) return '未填写订阅链接'
  try {
    return new URL(url).host
  } catch {
    return url.slice(0, 40)
  }
}

onMounted(load)
</script>

<template>
  <AppShell>
    <div class="page-head">
      <div>
        <h1 class="page-title">订阅</h1>
        <p class="page-sub">机场、官网与购买账号，集中在一处</p>
      </div>
      <n-button type="primary" @click="openCreate">新增订阅</n-button>
    </div>

    <div class="stats">
      <div class="stat">
        <div class="stat__label">全部</div>
        <div class="stat__value">{{ stats.total }}</div>
      </div>
      <div class="stat">
        <div class="stat__label">启用中</div>
        <div class="stat__value">{{ stats.active }}</div>
      </div>
      <div class="stat">
        <div class="stat__label">7 天内到期</div>
        <div class="stat__value">{{ stats.expiring }}</div>
      </div>
      <div class="stat">
        <div class="stat__label">已过期</div>
        <div class="stat__value">{{ stats.expired }}</div>
      </div>
    </div>

    <div class="toolbar">
      <n-input
        v-model:value="query"
        clearable
        placeholder="搜索名称、官网、机场账号"
        class="toolbar__search"
      />
      <n-select v-model:value="statusFilter" :options="statusOptions" class="toolbar__filter" />
      <n-select v-model:value="sortBy" :options="sortOptions" class="toolbar__filter" />
    </div>

    <div v-if="loading" style="padding: 56px; text-align: center">
      <n-spin size="large" />
    </div>

    <div v-else-if="!items.length" class="empty">
      还没有订阅。添加一个机场后，官网、账号、到期时间都会留在这里。
    </div>

    <div v-else-if="!visible.length" class="empty">
      没有匹配的订阅，换个关键词或筛选项试试。
    </div>

    <div v-else class="grid">
      <article
        v-for="item in visible"
        :key="item.id"
        class="card"
        :class="{ 'card--off': !item.enabled }"
      >
        <div class="card__head">
          <div class="card__name">{{ item.name }}</div>
          <n-tag size="small" :type="statusOf(item).type" :bordered="false">
            {{ statusOf(item).label }}
          </n-tag>
        </div>

        <div class="card__rows">
          <div class="row">
            <span class="row__label">官网</span>
            <span v-if="item.site_url" class="row__value mono">{{ item.site_url }}</span>
            <span v-else class="row__value muted">未填写</span>
            <n-button v-if="item.site_url" size="tiny" quaternary @click="openSite(item.site_url)">
              打开
            </n-button>
          </div>

          <div class="row">
            <span class="row__label">账号</span>
            <span v-if="item.account" class="row__value mono">{{ item.account }}</span>
            <span v-else class="row__value muted">未填写</span>
            <n-button v-if="item.account" size="tiny" quaternary @click="copy(item.account, '账号')">
              复制
            </n-button>
          </div>

          <div class="row">
            <span class="row__label">密码</span>
            <span v-if="item.password" class="row__value mono">
              {{ revealed[item.id] ? item.password : '••••••••' }}
            </span>
            <span v-else class="row__value muted">未填写</span>
            <n-button v-if="item.password" size="tiny" quaternary @click="toggle(item.id)">
              {{ revealed[item.id] ? '隐藏' : '显示' }}
            </n-button>
            <n-button v-if="item.password" size="tiny" quaternary @click="copy(item.password, '密码')">
              复制
            </n-button>
          </div>

          <div v-if="item.expire_at" class="row">
            <span class="row__label">到期</span>
            <span class="row__value">
              {{ formatDate(item.expire_at) }}
              <span class="muted">· {{ daysText(item) }}</span>
            </span>
          </div>

          <div v-if="item.traffic_total > 0" class="row">
            <span class="row__label">流量</span>
            <div class="row__value">
              <div class="traffic">
                <div class="traffic__bar" :style="{ width: `${trafficPercent(item)}%` }" />
              </div>
              <div class="traffic__note muted">
                {{ formatTraffic(item.traffic_used) }} / {{ formatTraffic(item.traffic_total) }}
              </div>
            </div>
          </div>

          <div v-if="item.note" class="row">
            <span class="row__label">备注</span>
            <span class="row__value muted">{{ item.note }}</span>
          </div>
        </div>

        <div class="card__foot">
          <span class="card__url mono muted">{{ shortHost(item.url) }}</span>
          <div class="card__actions">
            <n-button
              size="tiny"
              quaternary
              :loading="refreshing[item.id]"
              :disabled="!item.url"
              @click="refreshOne(item)"
            >
              刷新
            </n-button>
            <n-button size="tiny" quaternary @click="openEdit(item)">编辑</n-button>
            <n-button size="tiny" quaternary type="error" @click="remove(item)">删除</n-button>
          </div>
        </div>
      </article>
    </div>

    <n-modal
      v-model:show="editorOpen"
      preset="card"
      :title="editingId ? '编辑订阅' : '新增订阅'"
      style="width: min(560px, 92vw)"
    >
      <div class="form-grid">
        <label class="field">
          <span class="field__label">从订阅链接导入</span>
          <div class="field__row">
            <n-input
              v-model:value="importUrl"
              placeholder="粘贴 http(s) 链接，自动填名称、流量、到期"
              @keyup.enter="importFromLink"
            />
            <n-button :loading="importing" @click="importFromLink">读取</n-button>
          </div>
        </label>

        <label class="field">
          <span class="field__label">名称</span>
          <n-input v-model:value="form.name" placeholder="例如：XX云" />
        </label>

        <label class="field">
          <span class="field__label">订阅链接</span>
          <n-input v-model:value="form.url" placeholder="https://..." />
        </label>

        <label class="field">
          <span class="field__label">官网</span>
          <n-input v-model:value="form.site_url" placeholder="https://机场官网" />
        </label>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
          <label class="field">
            <span class="field__label">机场账号</span>
            <n-input v-model:value="form.account" placeholder="购买时注册的账号" />
          </label>
          <label class="field">
            <span class="field__label">机场密码</span>
            <n-input
              v-model:value="form.password"
              type="password"
              show-password-on="click"
              placeholder="机场密码"
            />
          </label>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
          <label class="field">
            <span class="field__label">到期时间</span>
            <n-date-picker v-model:value="form.expireAt" type="date" clearable style="width: 100%" />
          </label>
          <label class="field">
            <span class="field__label">启用</span>
            <n-switch v-model:value="form.enabled" />
          </label>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
          <label class="field">
            <span class="field__label">已用流量（GB）</span>
            <n-input-number v-model:value="form.usedGb" :min="0" :precision="2" style="width: 100%" />
          </label>
          <label class="field">
            <span class="field__label">总流量（GB）</span>
            <n-input-number
              v-model:value="form.totalGb"
              :min="0"
              :precision="2"
              style="width: 100%"
            />
          </label>
        </div>

        <label class="field">
          <span class="field__label">备注</span>
          <n-input
            v-model:value="form.note"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
            placeholder="套餐、到期提醒、客服方式等"
          />
        </label>
      </div>

      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px">
          <n-button quaternary @click="editorOpen = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="save">保存</n-button>
        </div>
      </template>
    </n-modal>
  </AppShell>
</template>
