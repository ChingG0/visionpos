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
  { path: '/login', name: 'Login', component: LoginView, meta: { public: true } },
  { path: '/', redirect: '/login' },

  {
    path: '/store/:storeCode',
    children: [
      { path: '',            redirect: to => ({ name: 'NewOrder', params: { storeCode: to.params.storeCode } }) },
      { path: 'new-order',   name: 'NewOrder',    component: NewOrderView },
      { path: 'dine-in',     name: 'DineIn',      component: DineInView },
      { path: 'takeout',     name: 'Takeout',     component: TakeoutView },
      { path: 'delivery',    name: 'Delivery',    component: DeliveryView },
      { path: 'reservation', name: 'Reservation', component: ReservationView },
      { path: 'settings/products',  name: 'ProductManagement', component: ProductManagementView },
      { path: 'settings/order',     name: 'OrderSettings',     component: OrderSettingsView },
      { path: 'settings/reports',   name: 'Reports',           component: ReportsView },
      { path: 'settings/inventory', name: 'Inventory',         component: InventoryView },
      { path: 'settings/members',   name: 'MemberManagement',  component: MemberManagementView },
      { path: 'settings/device',    name: 'DeviceManagement',  component: DeviceManagementView },
      { path: 'settings/staff',     name: 'StaffManagement',   component: StaffManagementView },
    ],
  },

  // 任何找不到的路徑都導向登入（處理 iOS PWA 重新整理）
  { path: '/:pathMatch(.*)*', redirect: '/login' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  if (to.meta.public) return true

  const raw  = localStorage.getItem('visionpos_auth')
  const auth = (() => { try { return JSON.parse(raw ?? '{}') } catch { return {} } })()
  const isLoggedIn = !!auth.s && !!auth.u

  // 未登入 → 登入頁
  if (!isLoggedIn) return { name: 'Login' }

  // 已登入但沒有 storeCode（例如直接打開 app 首頁）→ 自動補上
  if (!to.params.storeCode && auth.s?.code) {
    return { name: to.name ?? 'NewOrder', params: { storeCode: auth.s.code } }
  }
})

export default router