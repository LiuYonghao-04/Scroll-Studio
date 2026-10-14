import { createRouter, createWebHashHistory } from 'vue-router'
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: () => import('./views/HomeView.vue') },
    { path: '/editor', component: () => import('./views/EditorView.vue') },
    { path: '/render', component: () => import('./views/RenderView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
