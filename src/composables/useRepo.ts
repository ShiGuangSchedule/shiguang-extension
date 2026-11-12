// src/composables/useRepo.ts
import { ref, shallowRef, computed } from 'vue';
import type { LocalAdapterView, LocalSchoolEntry } from '@/modules/repo/types';
import {
  isFileSystemAccessSupported,
  pickRepoDirectory,
  getSavedRepoHandle,
  verifyPermission,
  loadAdapterList,
  loadAdapterCode,
  watchRepoDirectory,
} from '@/modules/repo/repository';

const isSupported = isFileSystemAccessSupported();
const repoHandle = shallowRef<FileSystemDirectoryHandle | null>(null);
const adapterList = ref<LocalAdapterView[]>([]);
const isLoading = ref<boolean>(false);
const errorMessage = ref<string | null>(null);
const hasSavedHandle = ref<boolean>(false);

let unwatchRepo: (() => void) | null = null;
let refreshTimer: any = null;

export function useRepo() {
  // 检查是否存在历史句柄
  async function checkSavedHandle() {
    if (!isSupported) return;
    try {
      const handle = await getSavedRepoHandle();
      hasSavedHandle.value = !!handle;
    } catch {
      hasSavedHandle.value = false;
    }
  }

  async function fetchData(handle: FileSystemDirectoryHandle, silent = false) {
    if (!silent) isLoading.value = true;
    try {
      errorMessage.value = null;
      const list = await loadAdapterList(handle);
      adapterList.value = list;
    } catch (e: any) {
      console.error('[useRepo] 加载仓库失败:', e);
      if (!silent) errorMessage.value = e?.message || '加载仓库失败';
    } finally {
      if (!silent) isLoading.value = false;
    }
  }

  function setupWatcher(handle: FileSystemDirectoryHandle) {
    // 清理旧监听
    if (unwatchRepo) {
      unwatchRepo();
      unwatchRepo = null;
    }
    
    unwatchRepo = watchRepoDirectory(handle, () => {
      // 防抖处理：如果 300ms 内频繁保存，只触发一次刷新
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(async () => {
        console.log('[useRepo] 检测到本地文件变动，正在静默刷新...');
        // silent 模式：背景刷新，不展示 loading 动画，不打断用户操作
        await fetchData(handle, true); 
      }, 300);
    });
  }

  async function refreshRepo() {
    if (!repoHandle.value) return;
    await fetchData(repoHandle.value, false);
  }

  // 1. 使用上次保存的目录
  async function restoreSavedRepo() {
    if (!isSupported) return;
    try {
      isLoading.value = true;
      errorMessage.value = null;

      const handle = await getSavedRepoHandle();
      if (!handle) {
        throw new Error('没有找到历史保存的目录记录');
      }

      const hasPerm = await verifyPermission(handle);
      if (!hasPerm) {
        throw new Error('未获得该目录的读取权限，请重新选择');
      }

      repoHandle.value = handle;
      await fetchData(handle, true); // 此时已经在 loading 状态中，静默拉取即可
      
      setupWatcher(handle);
    } catch (e: any) {
      console.error('[useRepo] 恢复历史仓库失败:', e);
      errorMessage.value = e?.message || '恢复历史仓库失败';
    } finally {
      isLoading.value = false;
    }
  }

  // 2. 主动选择新目录
  async function selectAndInitRepo() {
    if (!isSupported) return;
    try {
      isLoading.value = true;
      errorMessage.value = null;

      const handle = await pickRepoDirectory();
      const hasPerm = await verifyPermission(handle);
      
      if (!hasPerm) {
        throw new Error('未获得该目录的读取权限');
      }

      repoHandle.value = handle;
      await fetchData(handle, true);
      hasSavedHandle.value = true;
      
      setupWatcher(handle);
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.error('[useRepo] 选择仓库目录失败:', e);
        errorMessage.value = e?.message || '选择目录失败';
      }
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 按 category（3类）进行归类（带完备防空保护）
   */
  const categorizedAdapters = computed(() => {
    const categories = {
      BACHELOR_AND_ASSOCIATE: [] as LocalAdapterView[],
      POSTGRADUATE: [] as LocalAdapterView[],
      GENERAL_TOOL: [] as LocalAdapterView[],
    };

    if (!Array.isArray(adapterList.value)) {
      return categories;
    }

    for (const item of adapterList.value) {
      if (!item || !item.adapter) continue;
      const cat = item.adapter.category;
      if (cat && categories[cat as keyof typeof categories]) {
        categories[cat as keyof typeof categories].push(item);
      } else {
        categories.GENERAL_TOOL.push(item);
      }
    }

    return categories;
  });

  /**
   * 提取学校列表并排序：首字母大体定位，内部基于中文名称 localeCompare 排序
   */
  const sortedSchools = computed(() => {
    const schoolMap = new Map<string, LocalSchoolEntry>();
    if (Array.isArray(adapterList.value)) {
      for (const item of adapterList.value) {
        if (!item || !item.school) continue;
        const sId = item.school.id || item.school.name;
        if (!schoolMap.has(sId)) {
          schoolMap.set(sId, item.school);
        }
      }
    }

    const schools = Array.from(schoolMap.values());
    schools.sort((a, b) => {
      const initialCompare = (a.initial || '').localeCompare(b.initial || '');
      if (initialCompare !== 0) return initialCompare;
      return (a.name || '').localeCompare(b.name || '', 'zh-CN');
    });

    return schools;
  });

  async function getAdapterSource(view: LocalAdapterView): Promise<string> {
    if (!repoHandle.value) throw new Error('本地仓库未加载');
    return await loadAdapterCode(repoHandle.value, view);
  }

  // 初始化检查
  checkSavedHandle();

  return {
    isSupported,
    repoHandle,
    adapterList,
    categorizedAdapters,
    sortedSchools,
    isLoading,
    errorMessage,
    hasSavedHandle,
    restoreSavedRepo,
    selectAndInitRepo,
    getAdapterSource,
    refreshRepo,
  };
}