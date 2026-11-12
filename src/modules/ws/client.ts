// src/modules/ws/client.ts
import { wsConnection } from './connection';
import { wsPortItem, wsApiKeyItem } from '@/modules/storage';
import { wsState } from './state';
import { handleIncomingMessage, sendExtensionEnvironment } from './messages';

const BRIDGE_PATH = '/shiguang-bridge';

/**
 * 使用指定配置建立连接
 */
export async function connectWith(port: number, apiKey: string): Promise<void> {
  if (!apiKey) {
    throw new Error('WebSocket API Key 未配置');
  }

  const url = `ws://127.0.0.1:${port}${BRIDGE_PATH}?apiKey=${encodeURIComponent(apiKey)}`;

  await wsConnection.open(url, {
    onOpen: () => {
      wsState.isConnected = true;
      sendExtensionEnvironment().catch((e) => console.error('[WS] 环境上报失败:', e));
    },
    onMessage: (text) => handleIncomingMessage(text),
    onClose: (code, reason) => {
      wsState.isConnected = false;
    },
    onError: (event) => console.error('[WS] 连接错误:', event),
  });
}

/**
 * 使用持久化的配置建立连接
 */
export async function connect(): Promise<void> {
  const port = await wsPortItem.getValue();
  const apiKey = await wsApiKeyItem.getValue();
  await connectWith(port, apiKey);
}

/** 断开当前连接 */
export function disconnect(): void {
  wsConnection.close();
  wsState.isConnected = false;
}