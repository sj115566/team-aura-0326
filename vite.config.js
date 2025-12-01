import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// ⚠️ 請將這裡改成你的 GitHub Repository 名稱
// 例如：如果你的網址是 https://user.github.io/team-aura-pogo/
// 這裡就要填 '/team-aura-pogo/' (前後都要有斜線)
const REPO_NAME = '/team-aura-0326/'; 

export default defineConfig({
  // 設定基礎路徑，解決 404 問題
  base: REPO_NAME,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon.png'], // 確保包含本地圖片
      manifest: {
        name: 'Team Aura 波導戰隊',
        short_name: 'Team Aura',
        description: 'Team Aura 戰隊管理系統',
        theme_color: '#4f46e5',
        background_color: '#f8fafc',
        display: 'standalone',
        scope: './',      // 限制作用範圍在當前目錄
        start_url: './',  // 啟動時回到首頁 (相對路徑)
        icons: [
          {
            src: 'icon.png', // 使用本地路徑，不要用 https://...
            sizes: '192x192', // 這裡假設你用同一張圖，瀏覽器會縮放
            type: 'image/png'
          },
          {
            src: 'icon.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})