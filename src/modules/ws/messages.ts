// src/modules/ws/messages.ts
import { wsConnection } from './connection';
import type { ExtensionBridgeMessage } from './protocol';
import { wsApiKeyItem } from '@/modules/storage';
import { executionCache } from '@/modules/execution/cache';
import { wsState } from './state';
import type { CourseTableImportModel } from '@/modules/adapter-export/types';

/**
 * 底层通用发送函数
 */
export async function send<P extends Record<string, unknown>>(
  action: string,
  payload?: P,
): Promise<void> {
  const apiKey = await wsApiKeyItem.getValue();
  const message: ExtensionBridgeMessage<P> = {
    id: crypto.randomUUID(),
    action,
    apiKey,
    payload,
  };
  wsConnection.send(JSON.stringify(message));
}

/**
 * 连上后上报插件环境信息
 */
export async function sendExtensionEnvironment(): Promise<void> {
  await send('sync_extension_environment', {
    browserName: import.meta.env.BROWSER,
    extensionVersion: browser.runtime.getManifest().version,
  });
}

/**
 * 发送适配器解析好的课表数据给桌面端
 */
export async function sendCourseTableResult(data: CourseTableImportModel): Promise<void> {
  await send('course_table_result', data as unknown as Record<string, unknown>);
}

/**
 * 统一处理收到的 WebSocket 消息
 */
export function handleIncomingMessage(text: string): void {
  let message: ExtensionBridgeMessage;
  try {
    message = JSON.parse(text);
  } catch (e) {
    console.error('[WS] 消息解析失败:', e, text);
    return;
  }

  switch (message.action) {
    case 'execute_adapter': {
      const payload = message.payload as any;
      if (payload && typeof payload.adapterCode === 'string') {
        executionCache.replaceAll([{ name: '软件推送适配', code: payload.adapterCode }])
          .catch((e) => console.error('[WS] 缓存适配器失败:', e));
      }
      break;
    }
    case 'sync_app_environment': {
      const payload = message.payload as any;
      if (payload) {
        wsState.appVersion = payload.appVersion || '';
        wsState.platform = payload.platform || '';
      }
      break;
    }
    default:
      break;
  }
}