import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import './styles/global.css'
import './styles/editor-motion.css'
import './styles/projects.css'
import './styles/editor-v06.css'
createApp(App).use(createPinia()).use(router).mount('#app')
