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
          'react-vendor': [
            'react',
            'react-dom',
            'react-router-dom',
            'prop-types',
          ],
          // Microsoft SignalR
          'signalr': [
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
          // Syntax highlighting (large)
          'syntax-highlighter': [
            'react-syntax-highlighter',
          ],
          // Rehype highlight (large)
          'rehype-highlight': [
            'rehype-highlight',
          ],
          // Utility libraries
          'utils-vendor': [
            'axios',
            'light-classnames',
          ],
        }
      }
    }
  }
})