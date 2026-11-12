// src/modules/repo/repository.ts

import { load } from 'js-yaml';
import type {
  LocalRootIndex,
  LocalAdaptersFile,
  LocalAdapterView,
} from './types';

const IDB_NAME = 'shiguang-adapter';
const IDB_STORE = 'handles';
const IDB_KEY = 'repo-dir';

// ============================================================
// IndexedDB 持久化目录句柄相关操作
// ============================================================
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================================
// 目录选择与权限校验
// ============================================================
export function isFileSystemAccessSupported(): boolean {
  return typeof (window as any).showDirectoryPicker === 'function';
}

export async function pickRepoDirectory(): Promise<FileSystemDirectoryHandle> {
  const handle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker(
    { mode: 'read' },
  );
  await idbSet(IDB_KEY, handle);
  return handle;
}

export async function getSavedRepoHandle(): Promise<FileSystemDirectoryHandle | null> {
  const handle = await idbGet<FileSystemDirectoryHandle>(IDB_KEY);
  return handle ?? null;
}

export async function verifyPermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  const opts = { mode: 'read' as const };
  if ((await (handle as any).queryPermission(opts)) === 'granted') return true;
  if ((await (handle as any).requestPermission(opts)) === 'granted') return true;
  return false;
}

// ============================================================
// 文件内容读取
// ============================================================
async function readTextFile(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<string> {
  const segments = path.split('/').filter(Boolean);
  let current: FileSystemDirectoryHandle = root;
  
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    if (!segment) continue;
    current = await current.getDirectoryHandle(segment);
  }
  
  const fileName = segments[segments.length - 1];
  if (!fileName) {
    throw new Error(`无效的文件路径: ${path}`);
  }

  const fileHandle = await current.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  return await file.text();
}

// ============================================================
// 适配器数据解析
// ============================================================
export async function loadAdapterList(
  dir: FileSystemDirectoryHandle,
): Promise<LocalAdapterView[]> {
  const rootText = await readTextFile(dir, 'index/root_index.yaml');
  const root = load(rootText) as LocalRootIndex;
  if (!root?.schools) return [];

  const result: LocalAdapterView[] = [];
  for (const school of root.schools) {
    try {
      const adaptersPath = `resources/${school.resource_folder}/adapters.yaml`;
      const adaptersText = await readTextFile(dir, adaptersPath);
      const adaptersFile = load(adaptersText) as LocalAdaptersFile;
      if (!adaptersFile?.adapters) continue;
      for (const adapter of adaptersFile.adapters) {
        result.push({ adapter, school });
      }
    } catch (e) {
      console.warn(`[repo] 读取 ${school.name} 的 adapters 失败:`, e);
    }
  }
  return result;
}

export async function loadAdapterCode(
  dir: FileSystemDirectoryHandle,
  view: LocalAdapterView,
): Promise<string> {
  const path = `resources/${view.school.resource_folder}/${view.adapter.asset_js_path}`;
  return await readTextFile(dir, path);
}

// ============================================================
// 目录实时监听（静默执行）
// ============================================================
export function watchRepoDirectory(
  handle: FileSystemDirectoryHandle,
  onUpdate: () => void
): () => void {
  // 兼容性检查：仅在支持 FileSystemObserver 的浏览器中启用
  if (typeof window === 'undefined' || !('FileSystemObserver' in window)) {
    return () => {};
  }

  try {
    const observer = new (window as any).FileSystemObserver((records: any[]) => {
      if (records && records.length > 0) {
        onUpdate();
      }
    });

    // 递归监听目录，确保能捕获到子目录（如 resources/xxx/）内的文件变动
    observer.observe(handle, { recursive: true });

    return () => {
      try {
        observer.disconnect();
      } catch (e) {
        // 忽略断开时的异常
      }
    };
  } catch (e) {
    console.warn('[repo] 目录监听初始化失败，将仅依赖手动刷新');
    return () => {};
  }
}