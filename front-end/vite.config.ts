import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
 build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries
          'utils': [
            'react',
            'react-dom',
            'react-router-dom',
            'prop-types',
            'react-syntax-highlighter',
            'axios',
            'light-classnames',
            '@microsoft/signalr',
          ],
          // MUI and Emotion
          'mui-vendor': [
            '@mui/material',
            '@mui/icons-material',
            '@emotion/react',
            '@emotion/styled',
          ],
          // Markdown rendering
          'markdown-vendor': [
            'react-markdown',
            'remark-gfm',
          ],
          // Rehype highlight (large)
          'rehype-highlight': [
            'rehype-highlight',
          ],
        }
      }
    }
  }
})