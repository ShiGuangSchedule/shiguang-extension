import '@varlet/touch-emulator'
import { createApp } from 'vue'
import App from './App.vue'
import { StyleProvider, Themes } from '@varlet/ui'
import '@varlet/ui/es/style' 
import './style.css' 

function applyTheme() {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  StyleProvider(isDark ? Themes.md3Dark : Themes.md3Light)
}

applyTheme()
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme)

createApp(App).mount('#app')