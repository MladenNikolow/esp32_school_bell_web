import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

const deviceIP = '192.168.201.101'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    host: true, // allow LAN access if you want to open dev server from other devices
    port: 5173,
    proxy: {
      // forward /api/* to the ESP32
      '/api': {
        target: `http://${deviceIP}`,
        changeOrigin: true,
        secure: false,
        ws: false,
      }
    }
  }
})