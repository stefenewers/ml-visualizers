import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    // The algorithm cores are pure and have no DOM dependency, which is the point of
    // having extracted them out of the visualisation components.
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
})
