<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { ApiError, lastServer, login } from '../api/client'

const router = useRouter()
const message = useMessage()

const server = ref(lastServer())
const username = ref('')
const password = ref('')
const loading = ref(false)

const known: Record<string, string> = {
  invalid_credentials: '账号或密码不正确',
  account_disabled: '账号已停用',
  session_expired: '登录已过期，请重新登录',
  not_signed_in: '请先登录',
}

function humanize(error: unknown): string {
  if (error instanceof ApiError) {
    return known[error.detail] ?? `请求失败（${error.status}）`
  }
  return '连不上服务器，检查地址和网络'
}

async function submit(): Promise<void> {
  if (!server.value.trim() || !username.value.trim() || !password.value) {
    message.warning('服务器、账号、密码都要填')
    return
  }
  loading.value = true
  try {
    await login(server.value, username.value.trim(), password.value)
    router.replace({ name: 'subscriptions' })
  } catch (error) {
    message.error(humanize(error))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login">
    <section class="login__card">
      <div>
        <h1 class="login__title">FClash 控制台</h1>
        <p class="login__hint">登录你的同步账号，管理订阅、机场账号与设备。</p>
      </div>

      <div class="form-grid">
        <label class="field">
          <span class="field__label">服务器地址</span>
          <n-input
            v-model:value="server"
            placeholder="https://sync.example.com"
            :input-props="{ autocapitalize: 'off', autocomplete: 'url' }"
            @keyup.enter="submit"
          />
        </label>
        <label class="field">
          <span class="field__label">账号</span>
          <n-input v-model:value="username" placeholder="用户名" @keyup.enter="submit" />
        </label>
        <label class="field">
          <span class="field__label">密码</span>
          <n-input
            v-model:value="password"
            type="password"
            show-password-on="click"
            placeholder="密码"
            @keyup.enter="submit"
          />
        </label>
      </div>

      <n-button type="primary" block :loading="loading" @click="submit">登录</n-button>

      <p class="login__hint">
        忘记密码需要到服务器上用 <span class="mono">python -m app.cli reset-password</span> 重置。
      </p>
    </section>
  </div>
</template>
