<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { session, signOut } from '../api/client'

const router = useRouter()
const username = computed(() => session.value?.username ?? '')

function logout(): void {
  signOut()
  router.replace({ name: 'login' })
}
</script>

<template>
  <div class="shell">
    <header class="shell__bar">
      <div class="brand">
        <span class="brand__mark">F</span>
        <div>
          <div class="brand__name">FClash 控制台</div>
          <div class="brand__sub">{{ username }}</div>
        </div>
      </div>
      <nav class="nav">
        <router-link class="nav__link" :to="{ name: 'subscriptions' }">订阅</router-link>
        <router-link class="nav__link" :to="{ name: 'devices' }">设备</router-link>
      </nav>
      <n-button quaternary size="small" @click="logout">退出登录</n-button>
    </header>
    <main>
      <slot />
    </main>
  </div>
</template>
