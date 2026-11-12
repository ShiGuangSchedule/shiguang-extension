import { storage } from '#imports';
import type { CachedCodeUnit } from './types';

const STORAGE_KEY = 'local:execution-cache' as const;
const cacheItem = storage.defineItem<CachedCodeUnit[]>(STORAGE_KEY, {
  fallback: [],
});

class ExecutionCache {
  private units: CachedCodeUnit[] = [];
  private isReady = false;

  // 启动时从磁盘加载
  async init() {
    if (this.isReady) return;
    this.units = await cacheItem.getValue();
    this.isReady = true;
  }

  // 获取所有缓存对象
  getAll(): CachedCodeUnit[] {
    return this.units;
  }

  // 全量覆盖（来自本地仓库读取或 WS 全量推送）
  async replaceAll(newUnits: CachedCodeUnit[]) {
    this.units = [...newUnits];
    await cacheItem.setValue(this.units);
  }

  // 追加一条对象（临时测试用）
  async append(unit: CachedCodeUnit) {
    this.units.push(unit);
    await cacheItem.setValue(this.units);
  }

  // 清空
  async clear() {
    this.units = [];
    await cacheItem.setValue([]);
  }
}

export const executionCache = new ExecutionCache();