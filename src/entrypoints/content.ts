// src/entrypoints/content.ts
import { buildExecutableCode } from '@/modules/execution/engine';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    // 侧边栏 → content：注入代码 / 校验请求 / 桥接响应回传
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'TEST_ADAPTER_CODE') {
        try {
          const wrappedCode = buildExecutableCode(message.data);
          chrome.runtime.sendMessage({
            type: 'RUN_USER_SCRIPT',
            code: wrappedCode,
          }).then((res) => {
            sendResponse(res);
          }).catch((e) => {
            sendResponse({ success: false, error: e.message });
          });
        } catch (e: any) {
          sendResponse({ success: false, error: e.message });
        }
        return true;
      }

      if (message.type === 'SHIGUANG_VALIDATE_REQUEST') {
        const requestId = 'v_' + Date.now() + '_' + Math.random().toString(36).substring(2);
        const handler = (event: MessageEvent) => {
          if (event.data?.type === 'SHIGUANG_VALIDATE_RESPONSE' && event.data.requestId === requestId) {
            window.removeEventListener('message', handler);
            sendResponse(event.data.result);
          }
        };
        window.addEventListener('message', handler);

        window.postMessage({
          type: 'SHIGUANG_VALIDATE_REQUEST',
          requestId,
          validatorFnName: message.validatorFnName,
          inputValue: message.inputValue
        }, '*');
        return true;
      }

      if (message.type === 'SHIGUANG_BRIDGE_RESPONSE') {
        window.postMessage(message, '*');
      }
    });

    // USER_SCRIPT → 侧边栏：桥接调用转发
    window.addEventListener('message', (event) => {
      if (!event.data) return;

      if (event.data.type === 'SHIGUANG_BRIDGE_CALL') {
        try {
          chrome.runtime.sendMessage(event.data).catch(() => {
            // 忽略 The message port closed before a response was received.
          });
        } catch (e) {
          console.error('[Content] 桥接消息转发失败:', e);
        }
      }
    });
  },
});