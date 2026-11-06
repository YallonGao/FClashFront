<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { ApiError, changePassword, session, signOut } from '../api/client'

const router = useRouter()
const message = useMessage()

const username = computed(() => session.value?.username ?? '')
const server = computed(() => session.value?.baseUrl ?? '')

const passwordOpen = ref(false)
const saving = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const repeatPassword = ref('')

function logout(): void {
  signOut()
  router.replace({ name: 'login' })
}

function openPassword(): void {
  currentPassword.value = ''
  newPassword.value = ''
  repeatPassword.value = ''
  passwordOpen.value = true
}

async function submitPassword(): Promise<void> {
  if (newPassword.value.length < 8) {
    message.warning('新密码至少 8 位')
    return
  }
  if (newPassword.value !== repeatPassword.value) {
    message.warning('两次输入的新密码不一致')
    return
  }
  saving.value = true
  try {
    await changePassword(currentPassword.value, newPassword.value)
    passwordOpen.value = false
    message.success('密码已修改，其他设备不受影响')
  } catch (error) {
    const detail = error instanceof ApiError ? error.detail : ''
    message.error(detail === 'wrong_password' ? '当前密码不正确' : `修改失败（${detail || '网络错误'}）`)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="shell">
    <header class="shell__bar">
      <div class="brand">
        <span class="brand__mark">F</span>
        <div>
          <div class="brand__name">FClash 控制台</div>
          <div class="brand__sub">{{ username }} · {{ server }}</div>
        </div>
      </div>
      <nav class="nav">
        <router-link class="nav__link" :to="{ name: 'subscriptions' }">订阅</router-link>
        <router-link class="nav__link" :to="{ name: 'devices' }">设备</router-link>
      </nav>
      <div class="shell__actions">
        <n-button quaternary size="small" @click="openPassword">修改密码</n-button>
        <n-button quaternary size="small" @click="logout">退出登录</n-button>
      </div>
    </header>
    <main>
      <slot />
    </main>

    <n-modal
      v-model:show="passwordOpen"
      preset="card"
      title="修改密码"
      style="width: min(420px, 92vw)"
    >
      <div class="form-grid">
        <label class="field">
          <span class="field__label">当前密码</span>
          <n-input
            v-model:value="currentPassword"
            type="password"
            show-password-on="click"
            placeholder="当前密码"
          />
        </label>
        <label class="field">
          <span class="field__label">新密码</span>
          <n-input
            v-model:value="newPassword"
            type="password"
            show-password-on="click"
            placeholder="至少 8 位"
          />
        </label>
        <label class="field">
          <span class="field__label">确认新密码</span>
          <n-input
            v-model:value="repeatPassword"
            type="password"
            show-password-on="click"
            placeholder="再输入一次"
            @keyup.enter="submitPassword"
          />
        </label>
      </div>

      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px">
          <n-button quaternary @click="passwordOpen = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="submitPassword">保存</n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>
