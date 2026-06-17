import { createRouter, createWebHistory } from 'vue-router'
import ReceptionView from '../ReceptionView.vue'
import RoomView from '../RoomView.vue'
import LobbyView from '../LobbyView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/reception'
    },
    {
      path: '/reception',
      name: 'reception',
      component: ReceptionView
    },
    {
      path: '/room/:id',
      name: 'room',
      component: RoomView
    },
    {
      path: '/lobby',
      name: 'lobby',
      component: LobbyView
    }
  ]
})

export default router
