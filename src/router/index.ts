import { createRouter, createWebHashHistory } from 'vue-router'
import { session } from '../api/client'
import LoginView from '../views/LoginView.vue'
import SubscriptionsView from '../views/SubscriptionsView.vue'
import DevicesView from '../views/DevicesView.vue'

export const router = createRouter({
  // Hash history keeps deep links working from the FastAPI catch-all and from
  // any static file server without a rewrite rule.
  history: createWebHashHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    { path: '/', name: 'subscriptions', component: SubscriptionsView },
    { path: '/devices', name: 'devices', component: DevicesView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((to) => {
  if (!session.value && to.name !== 'login') return { name: 'login' }
  if (session.value && to.name === 'login') return { name: 'subscriptions' }
  return true
})
