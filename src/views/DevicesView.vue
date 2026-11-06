<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useDialog, useMessage } from 'naive-ui'
import AppShell from '../layout/AppShell.vue'
import { ApiError, listDevices, revokeDevice, session } from '../api/client'
import type { Device } from '../api/types'

const message = useMessage()
const dialog = useDialog()

const devices = ref<Device[]>([])
const loading = ref(false)

function humanize(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.detail === 'cannot_revoke_current') return '不能在这里注销当前设备'
    if (error.status === 401) return '登录已过期，请重新登录'
    return `请求失败（${error.status}）`
  }
  return '网络不可达，请检查服务器'
}

async function load(): Promise<void> {
  loading.value = true
  try {
    devices.value = await listDevices()
  } catch (error) {
    message.error(humanize(error))
  } finally {
    loading.value = false
  }
}

function revoke(device: Device): void {
  dialog.warning({
    title: '远程注销',
    content: `注销「${device.name || device.platform}」后，该设备上的 token 立即失效，需要重新登录。`,
    positiveText: '注销',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await revokeDevice(device.id)
        await load()
        message.success('已注销')
      } catch (error) {
        message.error(humanize(error))
      }
    },
  })
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

function isCurrent(device: Device): boolean {
  return device.id === session.value?.deviceId
}

onMounted(load)
</script>

<template>
  <AppShell>
    <div class="page-head">
      <div>
        <h1 class="page-title">设备</h1>
        <p class="page-sub">登录过这个账号的客户端，可远程注销</p>
      </div>
      <n-button quaternary :loading="loading" @click="load">刷新</n-button>
    </div>

    <div v-if="loading && !devices.length" style="padding: 56px; text-align: center">
      <n-spin size="large" />
    </div>

    <div v-else-if="!devices.length" class="empty">还没有设备登录记录</div>

    <div v-else>
      <div v-for="device in devices" :key="device.id" class="device">
        <div>
          <div class="device__name">
            {{ device.name || device.platform || '未命名设备' }}
            <n-tag v-if="isCurrent(device)" size="tiny" :bordered="false" type="info">当前</n-tag>
            <n-tag v-if="device.revoked" size="tiny" :bordered="false" type="error">已注销</n-tag>
          </div>
          <div class="device__meta">
            {{ device.platform || '未知平台' }} · 最近活跃 {{ formatTime(device.last_seen_at) }} ·
            添加于 {{ formatTime(device.created_at) }}
          </div>
        </div>
        <n-button
          size="small"
          quaternary
          type="error"
          :disabled="isCurrent(device) || device.revoked"
          @click="revoke(device)"
        >
          注销
        </n-button>
      </div>
    </div>
  </AppShell>
</template>
