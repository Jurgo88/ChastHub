import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const src = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '~': src,
      '@': src,
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.{test,spec}.ts'],
  },
})
