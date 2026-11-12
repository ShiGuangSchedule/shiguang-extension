// wxt.config.ts
import { defineConfig } from 'wxt';
import components from 'unplugin-vue-components/vite';
import autoImport from 'unplugin-auto-import/vite';
import { VarletImportResolver } from '@varlet/import-resolver';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: [
    '@wxt-dev/module-vue',
    '@wxt-dev/auto-icons',
  ],
  srcDir: 'src',
  publicDir: 'public',

  autoIcons: {
    baseIconPath: 'assets/icon.png',
  },

  manifest: ({ browser }) => {
    const i18nBase = {
      name: '__MSG_extName__',
      description: '__MSG_extDescription__',
      default_locale: 'zh_CN',
    };

    const chromeManifest = {
      ...i18nBase,
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
      ...i18nBase,
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
        gecko: {
          id: 'shiguang-extension@ShiGuangSchedule',
          strict_min_version: '153.0',
          data_collection_permissions: {
            required: ['none'],
          },
        },
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