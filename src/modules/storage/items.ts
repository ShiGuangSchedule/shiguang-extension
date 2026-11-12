// src/modules/storage/items.ts
import { storage } from '#imports';

// WebSocket 端口号
export const wsPortItem = storage.defineItem<number>(
  'local:pref:ws-port',
  { fallback: 59508 }
);

// WebSocket API Key
export const wsApiKeyItem = storage.defineItem<string>(
  'local:pref:ws-api-key',
  { fallback: '' }
);

// 导出行为策略：'file' 为本地文件，'app' 为传入应用(WS)
export type ExportStrategy = 'file' | 'app';

// 导出行为配置
export const exportStrategyItem = storage.defineItem<ExportStrategy>(
  'local:pref:export-strategy',
  { fallback: 'file' }
);