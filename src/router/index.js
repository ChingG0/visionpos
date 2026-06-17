import { createRouter, createWebHistory } from 'vue-router'

import NewOrderView    from '@/views/NewOrderView.vue'
import DineInView      from '@/views/DineInView.vue'
import DeliveryView    from '@/views/DeliveryView.vue'
import ReservationView from '@/views/ReservationView.vue'

import ProductManagementView from '@/views/ProductManagementView.vue'
import OrderSettingsView     from '@/views/OrderSettingsView.vue'
import ReportsView           from '@/views/ReportsView.vue'
import InventoryView         from '@/views/InventoryView.vue'
import MemberManagementView  from '@/views/MemberManagementView.vue'

const routes = [
  { path: '/', redirect: { name: 'NewOrder' } },

  /* 主功能 */
  { path: '/new-order',   name: 'NewOrder',    component: NewOrderView },
  { path: '/dine-in',     name: 'DineIn',      component: DineInView },
  { path: '/delivery',    name: 'Delivery',    component: DeliveryView },
  { path: '/reservation', name: 'Reservation', component: ReservationView },

  /* 後台設定 */
  { path: '/settings/products',  name: 'ProductManagement', component: ProductManagementView },
  { path: '/settings/order',     name: 'OrderSettings',     component: OrderSettingsView },
  { path: '/settings/reports',   name: 'Reports',           component: ReportsView },
  { path: '/settings/inventory', name: 'Inventory',         component: InventoryView },
  { path: '/settings/members',   name: 'MemberManagement',  component: MemberManagementView },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})