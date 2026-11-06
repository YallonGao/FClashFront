<script setup lang="ts">
import { darkTheme, type GlobalThemeOverrides } from 'naive-ui'

const overrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#3d7dff',
    primaryColorHover: '#5f95ff',
    primaryColorPressed: '#2f66d6',
    primaryColorSuppl: '#3d7dff',
    borderRadius: '10px',
    bodyColor: '#0a0e14',
    cardColor: '#111823',
    modalColor: '#111823',
    popoverColor: '#161f2c',
  },
}
</script>

<template>
  <n-config-provider :theme="darkTheme" :theme-overrides="overrides">
    <n-message-provider>
      <n-dialog-provider>
        <router-view />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>
