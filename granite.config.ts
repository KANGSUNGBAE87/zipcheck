import { defineConfig } from '@apps-in-toss/web-framework/config';

const env = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const appsInTossWebHost = env.APPS_IN_TOSS_WEB_HOST ?? '127.0.0.1';
const appsInTossIconUrl = env.APPS_IN_TOSS_ICON_URL ?? 'https://kangsungbae87.github.io/zipcheck/zipcheck-icon.svg';

export default defineConfig({
  appName: 'zipcheck',
  brand: {
    displayName: 'ZIPCHECK',
    primaryColor: '#1B7059',
    icon: appsInTossIconUrl,
  },
  web: {
    host: appsInTossWebHost,
    port: 5173,
    commands: {
      dev: 'vite --host',
      build: 'vite build',
    },
  },
  permissions: [],
  outdir: 'dist',
});
