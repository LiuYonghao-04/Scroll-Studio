import { createRouter, createWebHashHistory } from 'vue-router'
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: () => import('./views/HomeView.vue') },
    { path: '/projects', component: () => import('./views/ProjectsView.vue') },
    { path: '/editor/:projectId?', component: () => import('./views/EditorView.vue') },
    { path: '/render', component: () => import('./views/RenderView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
