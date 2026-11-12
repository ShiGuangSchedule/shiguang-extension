// src/modules/execution/engine.ts

/**
 * 将适配代码包裹为可在页面主世界执行的完整脚本。
 * 包含桥接 API 挂载、校验函数注册、重复注入清理。
 */
export function buildExecutableCode(code: string): string {
  const functionNames: string[] = [];
  const fnRegex = /function\s+([a-zA-Z_$][\w$]*)\s*\(/g;
  let match;
  while ((match = fnRegex.exec(code)) !== null) {
    if (match[1]) {
      functionNames.push(match[1]);
    }
  }

  const exposeFunctionsCode = functionNames
    .map(
      (name) =>
        `if (typeof ${name} === 'function') { window.__shiguang_validators__['${name}'] = ${name}; }`,
    )
    .join('\n');

  return `
    (function() {
      // 清理上一次注入的监听器与校验池，避免重复注入累积
      if (typeof window.__shiguang_bridge_cleanup__ === 'function') {
        try { window.__shiguang_bridge_cleanup__(); } catch (_) {}
      }

      window.__shiguang_validators__ = {};
      const pendingCallbacks = {};
      let callbackCounter = 0;

      // 接收 content 转发的响应与校验请求
      function handleMessage(event) {
        if (!event.data) return;
        const data = event.data;

        if (data.type === 'SHIGUANG_BRIDGE_RESPONSE') {
          const cb = pendingCallbacks[data.callbackId];
          if (cb) {
            if (data.success) cb.resolve(data.data);
            else cb.reject(new Error(data.error || '未知错误'));
            delete pendingCallbacks[data.callbackId];
          }
          return;
        }

        if (data.type === 'SHIGUANG_VALIDATE_REQUEST') {
          const fn = window.__shiguang_validators__[data.validatorFnName];
          const result = { error: null };
          if (typeof fn === 'function') {
            try {
              const r = fn(data.inputValue);
              if (typeof r === 'string' && r.trim() !== '') result.error = r;
            } catch (e) {
              result.error = '校验函数执行出错: ' + e.message;
            }
          }
          window.postMessage({
            type: 'SHIGUANG_VALIDATE_RESPONSE',
            requestId: data.requestId,
            result,
          }, '*');
        }
      }

      window.addEventListener('message', handleMessage);

      window.__shiguang_bridge_cleanup__ = function () {
        window.removeEventListener('message', handleMessage);
        window.__shiguang_validators__ = {};
      };

      // 统一发送桥接调用到 content
      function callNative(action, payload) {
        return new Promise((resolve, reject) => {
          const callbackId = 'cb_' + (++callbackCounter) + '_' + Date.now();
          pendingCallbacks[callbackId] = { resolve, reject };
          window.postMessage({
            type: 'SHIGUANG_BRIDGE_CALL',
            action,
            payload,
            callbackId,
          }, '*');
        });
      }

      window.shiguangBridge = {
        showToast: (message) => callNative('showToast', { message }),
        notifyTaskCompletion: () => callNative('notifyTaskCompletion', {}),
      };

      window.shiguangBridgePromise = {
        showAlert: (title, content, confirmText) => callNative('showAlert', { title, content, confirmText }),
        showPrompt: (title, tip, defaultText, validatorJsFunction) => callNative('showPrompt', { title, tip, defaultText, validatorJsFunction }),
        showSingleSelection: (title, itemsJsonString, defaultSelectedIndex) => callNative('showSingleSelection', { title, itemsJsonString, defaultSelectedIndex }),
        saveImportedCourses: (coursesJsonString) => callNative('saveImportedCourses', { coursesJsonString }),
        savePresetTimeSlots: (timeSlotsJsonString) => callNative('savePresetTimeSlots', { timeSlotsJsonString }),
        saveCourseConfig: (configJsonString) => callNative('saveCourseConfig', { configJsonString }),
        saveComboSchedule: (comboScheduleJsonString) => callNative('saveComboSchedule', { comboScheduleJsonString }),
      };

      // 执行开发者源码并暴露具名函数为校验函数
      try {
        ${code}

        ${exposeFunctionsCode}
      } catch (e) {
        console.error('[ShiguangBridge] 适配脚本执行异常:', e);
        if (window.shiguangBridge && window.shiguangBridge.showToast) {
          window.shiguangBridge.showToast('适配脚本执行出错: ' + e.message);
        }
      }
    })();
  `;
}