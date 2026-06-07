import { createRouter, createWebHistory } from 'vue-router'
import DineInView from '@/views/DineInView.vue'

const routes = [
  { path: '/', redirect: { name: 'DineIn' } },
  { path: '/dine-in',      name: 'DineIn',      component: DineInView },
  // 之後補上其他頁面
  // { path: '/takeout',     name: 'Takeout',     component: () => import('@/views/TakeoutView.vue') },
  // { path: '/delivery',    name: 'Delivery',    component: () => import('@/views/DeliveryView.vue') },
  // { path: '/reservation', name: 'Reservation', component: () => import('@/views/ReservationView.vue') },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})