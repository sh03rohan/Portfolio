import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      // ecctrl pulls in leva only for its debug GUI, which we never show.
      // See src/stubs/leva.js — this keeps ~700kB of panel code out of the
      // bundle. Remove this line if you want <Ecctrl debug>.
      leva: fileURLToPath(new URL('./src/stubs/leva.js', import.meta.url)),
    },
  },

  // Rapier ships as WASM; Vite needs to leave it alone during dep optimization.
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat'],
  },

  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Split the heavy, rarely-changing libraries into their own chunks so
        // a content edit doesn't invalidate three.js in everyone's cache.
        manualChunks: {
          three: ['three'],
          rapier: ['@dimforge/rapier3d-compat', '@react-three/rapier'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
})
