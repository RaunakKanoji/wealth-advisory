import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['src/coach/persistence.integration.ts'],fileParallelism:false,hookTimeout:30000}});
