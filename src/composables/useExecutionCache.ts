// src/composables/useExecutionCache.ts
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { storage } from '#imports';
import { browser } from 'wxt/browser';
import type { CachedCodeUnit } from '@/modules/execution/types';
import { showSidepanelToast } from '@/composables/useSidepanelToast';

export function useExecutionCache() {
  const units = ref<CachedCodeUnit[]>([]);
  const isExecuting = ref(false);
  
  // 权限状态
  const hasUserScriptPermission = ref(false);

  const cacheItem = storage.defineItem<CachedCodeUnit[]>('local:execution-cache', { fallback: [] });
  let unwatch: (() => void) | null = null;

  // 检查权限（区分 Chrome 和 Firefox 的检测机制）
  async function checkPermission() {
    try {
      if (import.meta.env.FIREFOX) {
        // Firefox 下，userScripts 是 optional_permissions
        const has = await browser.permissions.contains({ permissions: ['userScripts'] });
        if (has !== hasUserScriptPermission.value) {
          console.log('[权限检测] Firefox userScripts 状态变化:', has);
          hasUserScriptPermission.value = has;
        }
      } else {
        // Chrome / Edge 下，必须在设置里手动开启开关，开启后 browser.userScripts 才会存在
        const has = !!(browser as any).userScripts;
        if (has !== hasUserScriptPermission.value) {
          console.log('[权限检测] Chrome/Edge userScripts 状态变化:', has);
          hasUserScriptPermission.value = has;
        }
      }
    } catch (e) {
      console.error('[权限检测] 检测异常:', e);
      hasUserScriptPermission.value = false;
    }
  }

  onMounted(async () => {
    await checkPermission();

    units.value = await cacheItem.getValue();
    unwatch = cacheItem.watch((newValue) => {
      units.value = newValue || [];
    });

    // 当用户去设置页开启权限后切回侧边栏，重新检查权限状态
    window.addEventListener('focus', checkPermission);
  });

  onUnmounted(() => {
    if (unwatch) unwatch();
    window.removeEventListener('focus', checkPermission);
  });

  const currentUnit = computed(() => {
    if (!units.value || units.value.length === 0) return null;
    return units.value[units.value.length - 1];
  });

  function openImportUrl() {
    if (currentUnit.value?.importUrl) {
      browser.tabs.create({ url: currentUnit.value.importUrl });
    }
  }

  // 跳转授权页
  function goToPermissionSettings() {
    if (import.meta.env.FIREFOX) {
      browser.tabs.create({ url: 'about:addons' });
      showSidepanelToast('请在附加组件管理器中，找到拾光并授予权限');
    } else {
      const url = `chrome://extensions/?id=${browser.runtime.id}`;
      browser.tabs.create({ url });
      showSidepanelToast('请在页面中开启“允许运行用户脚本”权限');
    }
  }

  // 执行适配器
  async function executeAdapter() {
    if (!currentUnit.value || isExecuting.value) return;
    if (!hasUserScriptPermission.value) {
      showSidepanelToast('请先开启用户脚本权限');
      return;
    }

    isExecuting.value = true;
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      
      if (!tab?.id) {
        showSidepanelToast('没有找到当前激活的页面');
        return;
      }

      showSidepanelToast('正在执行适配器...');

      const response: any = await browser.tabs.sendMessage(tab.id, { 
        type: 'TEST_ADAPTER_CODE', 
        data: currentUnit.value.code 
      });

      if (!response?.success) {
        showSidepanelToast('执行失败: ' + (response?.error || '未知错误'));
      }
    } catch (e: any) {
      showSidepanelToast('执行异常: ' + (e.message || '未知错误'));
    } finally {
      isExecuting.value = false;
    }
  }

  return {
    currentUnit,
    isExecuting,
    hasUserScriptPermission,
    openImportUrl,
    goToPermissionSettings,
    executeAdapter,
  };
}