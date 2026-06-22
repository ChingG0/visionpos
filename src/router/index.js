import { createRouter, createWebHistory } from 'vue-router'

import LoginView             from '@/views/LoginView.vue'
import NewOrderView          from '@/views/NewOrderView.vue'
import DineInView            from '@/views/DineInView.vue'
import TakeoutView           from '@/views/TakeoutView.vue'
import DeliveryView          from '@/views/DeliveryView.vue'
import ReservationView       from '@/views/ReservationView.vue'
import ProductManagementView from '@/views/ProductManagementView.vue'
import OrderSettingsView     from '@/views/OrderSettingsView.vue'
import ReportsView           from '@/views/ReportsView.vue'
import InventoryView         from '@/views/InventoryView.vue'
import MemberManagementView  from '@/views/MemberManagementView.vue'
import DeviceManagementView  from '@/views/DeviceManagementView.vue'
import StaffManagementView   from '@/views/StaffManagementView.vue'

const routes = [
  // 登入（公開）
  { path: '/login',   name: 'Login',   component: LoginView, meta: { public: true } },
  { path: '/',        redirect: { name: 'Login' } },

  // 店家路由：/store/:storeCode/...
  {
    path: '/store/:storeCode',
    children: [
      { path: '',            redirect: to => ({ name: 'NewOrder', params: { storeCode: to.params.storeCode } }) },
      { path: 'new-order',   name: 'NewOrder',    component: NewOrderView },
      { path: 'dine-in',     name: 'DineIn',      component: DineInView },
      { path: 'takeout',     name: 'Takeout',     component: TakeoutView },
      { path: 'delivery',    name: 'Delivery',    component: DeliveryView },
      { path: 'reservation', name: 'Reservation', component: ReservationView },

      // 後台設定
      { path: 'settings/products',  name: 'ProductManagement', component: ProductManagementView },
      { path: 'settings/order',     name: 'OrderSettings',     component: OrderSettingsView },
      { path: 'settings/reports',   name: 'Reports',           component: ReportsView },
      { path: 'settings/inventory', name: 'Inventory',         component: InventoryView },
      { path: 'settings/members',   name: 'MemberManagement',  component: MemberManagementView },
      { path: 'settings/device',    name: 'DeviceManagement',  component: DeviceManagementView },
      { path: 'settings/staff',     name: 'StaffManagement',   component: StaffManagementView },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// ── 導航守衛 ──────────────────────────────────────────────────────────────────
router.beforeEach((to) => {
  if (to.meta.public) return true

  const raw = localStorage.getItem('visionpos_auth')
  const auth = (() => {
    try { return JSON.parse(raw ?? '{}') } catch { return {} }
  })()
  const isLoggedIn = !!auth.s && !!auth.u

  if (!isLoggedIn) return { name: 'Login' }

  // 如果已登入但 URL 沒有 storeCode，導向正確路徑
  if (!to.params.storeCode && auth.s?.code) {
    return { name: to.name ?? 'NewOrder', params: { storeCode: auth.s.code } }
  }
})

export default router