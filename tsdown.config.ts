import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./lib/index.ts'],
  dts: {
    tsgo: true,
  },
  exports: true,
})
