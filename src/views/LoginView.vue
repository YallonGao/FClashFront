<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { ApiError, lastServer, login, pingServer, register } from '../api/client'

const router = useRouter()
const message = useMessage()

const mode = ref<'login' | 'register'>('login')
const server = ref(lastServer())
const username = ref('')
const password = ref('')
const loading = ref(false)
const testing = ref(false)
const reachable = ref<'unknown' | 'ok' | 'fail'>('unknown')

const isRegister = computed(() => mode.value === 'register')

const known: Record<string, string> = {
  invalid_credentials: '账号或密码不正确',
  account_disabled: '账号已停用',
  session_expired: '登录已过期，请重新登录',
  not_signed_in: '请先登录',
  username_taken: '这个用户名已经被注册了',
  registration_closed: '服务器已关闭注册，请用已有账号登录',
}

function humanize(error: unknown): string {
  if (error instanceof ApiError) {
    return known[error.detail] ?? `请求失败（${error.status}）`
  }
  return '连不上服务器，检查地址和网络'
}

function switchMode(): void {
  mode.value = isRegister.value ? 'login' : 'register'
}

async function testServer(): Promise<void> {
  if (!server.value.trim()) {
    message.warning('先填服务器地址')
    return
  }
  testing.value = true
  reachable.value = 'unknown'
  try {
    await pingServer(server.value)
    reachable.value = 'ok'
    message.success('服务器可达')
  } catch {
    reachable.value = 'fail'
    message.error('连不上：检查地址、端口和防火墙')
  } finally {
    testing.value = false
  }
}

async function submit(): Promise<void> {
  if (!server.value.trim() || !username.value.trim() || !password.value) {
    message.warning('服务器、账号、密码都要填')
    return
  }
  if (isRegister.value && password.value.length < 8) {
    message.warning('密码至少 8 位')
    return
  }
  loading.value = true
  try {
    if (isRegister.value) {
      await register(server.value, username.value.trim(), password.value)
      message.success('账号已创建，正在进入控制台')
    } else {
      await login(server.value, username.value.trim(), password.value)
    }
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
        <h1 class="login__title">{{ isRegister ? '创建账号' : 'FClash 控制台' }}</h1>
        <p class="login__hint">
          {{
            isRegister
              ? '账号建在你自己服务器上，之后所有设备都用它同步配置。'
              : '登录你的同步账号，管理订阅、机场账号与设备。'
          }}
        </p>
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
          <div class="field__row">
            <n-button size="tiny" quaternary :loading="testing" @click="testServer">
              测试连接
            </n-button>
            <span v-if="reachable === 'ok'" class="field__hint field__hint--ok">可达</span>
            <span v-else-if="reachable === 'fail'" class="field__hint field__hint--bad">
              不可达
            </span>
          </div>
        </label>
        <label class="field">
          <span class="field__label">账号</span>
          <n-input
            v-model:value="username"
            placeholder="3-32 位，字母数字或 _ . -"
            @keyup.enter="submit"
          />
        </label>
        <label class="field">
          <span class="field__label">密码</span>
          <n-input
            v-model:value="password"
            type="password"
            show-password-on="click"
            :placeholder="isRegister ? '至少 8 位' : '密码'"
            @keyup.enter="submit"
          />
        </label>
      </div>

      <n-button type="primary" block :loading="loading" @click="submit">
        {{ isRegister ? '注册并登录' : '登录' }}
      </n-button>

      <n-button quaternary block size="small" @click="switchMode">
        {{ isRegister ? '已经有账号了，去登录' : '没有账号？创建一个' }}
      </n-button>

      <p class="login__hint">
        忘记密码只能在服务器上重置：<span class="mono">python -m app.cli reset-password 用户名</span>
      </p>
    </section>
  </div>
</template>
