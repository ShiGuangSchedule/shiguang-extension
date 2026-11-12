// wxt.config.ts
import { defineConfig } from 'wxt';
import components from 'unplugin-vue-components/vite';
import autoImport from 'unplugin-auto-import/vite';
import { VarletImportResolver } from '@varlet/import-resolver';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  srcDir: 'src',
  manifest: ({ browser }) => {
    const chromeManifest = {
      permissions: [
        'storage',
        'scripting',
        'userScripts',
        'downloads',
        'notifications',
        'activeTab',
        'sidePanel',
      ],
      host_permissions: ['<all_urls>'],
      minimum_chrome_version: '135',
      side_panel: { default_path: 'sidepanel.html' },
    };

    const firefoxManifest = {
      permissions: [
        'storage',
        'scripting',
        'downloads',
        'notifications',
        'activeTab',
      ],
      optional_permissions: ['userScripts'],
      host_permissions: ['<all_urls>'],
      sidebar_action: { default_panel: 'sidepanel.html' },
      browser_specific_settings: {
        gecko: { id: 'shiguang-extension@example.com', strict_min_version: '135.0' },
      },
    };

    return browser === 'firefox' ? firefoxManifest : chromeManifest;
  },
  vite: () => ({
    plugins: [
      components({
        resolvers: [VarletImportResolver()],
        dts: 'components.d.ts',
      }),
      autoImport({
        resolvers: [VarletImportResolver({ autoImport: true })],
        dts: 'auto-imports.d.ts',
      }),
    ],
  }),
});