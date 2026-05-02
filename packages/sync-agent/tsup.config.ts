import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  banner: {
    js: '#!/usr/bin/env node',
  },
})
