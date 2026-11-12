<!-- src/components/BridgeUI.vue -->
<script setup lang="ts">
import { showSidepanelToast } from '@/composables/useSidepanelToast';
import {
  saveImportedCourses,
  savePresetTimeSlots,
  saveCourseConfig,
  saveComboSchedule,
  buildExportPayload,
  resetSession,
  downloadJsonFile,
} from '@/modules/adapter-export';
import { exportStrategyItem } from '@/modules/storage';
import { sendCourseTableResult, wsState } from '@/modules/ws';

// Alert 弹窗状态
const alertState = reactive({
  show: false,
  title: '',
  content: '',
  confirmText: '',
  resolve: null as ((value: boolean) => void) | null,
});

function showAlert(title: string, content: string, confirmText: string): Promise<boolean> {
  return new Promise((resolve) => {
    alertState.title = title;
    alertState.content = content;
    alertState.confirmText = confirmText || '确定';
    alertState.resolve = resolve;
    alertState.show = true;
  });
}

function onAlertConfirm() {
  alertState.resolve?.(true);
  alertState.resolve = null;
  alertState.show = false;
}

function onAlertCancel() {
  alertState.resolve?.(false);
  alertState.resolve = null;
  alertState.show = false;
}

function onAlertClosed() {
  if (alertState.resolve) {
    alertState.resolve(false);
    alertState.resolve = null;
  }
}

// Prompt 弹窗状态
const promptState = reactive({
  show: false,
  title: '',
  tip: '',
  inputValue: '',
  errorMsg: '',
  validatorJsFunction: '',
  resolve: null as ((value: string | null) => void) | null,
});

function showPrompt(title: string, tip: string, defaultText: string, validatorJsFunction?: string): Promise<string | null> {
  return new Promise((resolve) => {
    promptState.title = title;
    promptState.tip = tip;
    promptState.inputValue = defaultText;
    promptState.errorMsg = '';
    promptState.validatorJsFunction = validatorJsFunction || '';
    promptState.resolve = resolve;
    promptState.show = true;
  });
}

function onPromptBeforeClose(action: string, done: () => void) {
  if (action === 'cancel' || action === 'close') {
    promptState.resolve?.(null);
    promptState.resolve = null;
    done();
    return;
  }

  if (action === 'confirm') {
    if (!promptState.validatorJsFunction) {
      promptState.resolve?.(promptState.inputValue);
      promptState.resolve = null;
      done();
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.id) {
        promptState.errorMsg = '找不到当前标签页';
        return;
      }
      chrome.tabs.sendMessage(tab.id, {
        type: 'SHIGUANG_VALIDATE_REQUEST',
        validatorFnName: promptState.validatorJsFunction,
        inputValue: promptState.inputValue
      }, (res) => {
        if (chrome.runtime.lastError) {
          promptState.errorMsg = '校验通信失败: ' + chrome.runtime.lastError.message;
        } else if (res && res.error) {
          promptState.errorMsg = res.error;
        } else {
          promptState.resolve?.(promptState.inputValue);
          promptState.resolve = null;
          done();
        }
      });
    });
  }
}

// SingleSelection 弹窗状态
const selectionState = reactive({
  show: false,
  title: '',
  items: [] as string[],
  selectedIndex: -1,
  resolve: null as ((value: number | null) => void) | null,
});

function showSingleSelection(title: string, items: string[], defaultIndex: number): Promise<number | null> {
  return new Promise((resolve) => {
    selectionState.title = title;
    selectionState.items = items;
    selectionState.selectedIndex = defaultIndex;
    selectionState.resolve = resolve;
    selectionState.show = true;
  });
}

function onSelectionBeforeClose(action: string, done: () => void) {
  if (action === 'cancel' || action === 'close') {
    selectionState.resolve?.(null);
    selectionState.resolve = null;
    done();
    return;
  }
  if (action === 'confirm') {
    if (selectionState.selectedIndex === -1) return;
    selectionState.resolve?.(selectionState.selectedIndex);
    selectionState.resolve = null;
    done();
  }
}

// 消息监听与分发
function handleBridgeMessage(message: any, sender: chrome.runtime.MessageSender) {
  if (message.type !== 'SHIGUANG_BRIDGE_CALL') return;

  const { action, payload, callbackId } = message;
  const tabId = sender.tab?.id;
  if (!tabId) return;

  const reply = (success: boolean, data?: any, error?: string) => {
    chrome.tabs.sendMessage(tabId, {
      type: 'SHIGUANG_BRIDGE_RESPONSE',
      callbackId,
      success,
      data,
      error
    }).catch(e => console.error('[BridgeUI] 回传失败:', e));
  };

  switch (action) {
    case 'showToast':
      showSidepanelToast(payload.message);
      reply(true);
      break;

        case 'notifyTaskCompletion':
      // 结束信号：根据用户配置的导出策略选择通道
      (async () => {
        try {
          const data = buildExportPayload();
          const strategy = await exportStrategyItem.getValue();

          if (strategy === 'app') {
            if (!wsState.isConnected) {
              throw new Error('未连接到桌面应用，请在主页的“连接”卡片中检查配置');
            }
            await sendCourseTableResult(data);
            showSidepanelToast('已成功推送至桌面应用');
          } else {
            const filename = await downloadJsonFile(data);
            showSidepanelToast(`已导出本地文件：${filename}`);
          }

          resetSession();
          reply(true, true);
        } catch (e: any) {
          showSidepanelToast(`导出失败：${e.message}`);
          reply(false, null, e.message);
        }
      })();
      break;

    case 'showAlert':
      showAlert(payload.title, payload.content, payload.confirmText)
        .then(result => reply(true, result))
        .catch(err => reply(false, null, err.message));
      break;

    case 'showPrompt':
      showPrompt(payload.title, payload.tip, payload.defaultText, payload.validatorJsFunction)
        .then(result => reply(true, result))
        .catch(err => reply(false, null, err.message));
      break;

    case 'showSingleSelection':
      try {
        const items = JSON.parse(payload.itemsJsonString);
        showSingleSelection(payload.title, items, payload.defaultSelectedIndex ?? -1)
          .then(result => reply(true, result))
          .catch(err => reply(false, null, err.message));
      } catch (e: any) {
        reply(false, null, '选项数据解析失败: ' + e.message);
      }
      break;

    case 'saveImportedCourses':
      try {
        saveImportedCourses(payload.coursesJsonString);
        reply(true, true);
      } catch (e: any) {
        reply(false, null, e.message);
      }
      break;

    case 'savePresetTimeSlots':
      try {
        savePresetTimeSlots(payload.timeSlotsJsonString);
        reply(true, true);
      } catch (e: any) {
        reply(false, null, e.message);
      }
      break;

    case 'saveCourseConfig':
      try {
        saveCourseConfig(payload.configJsonString);
        reply(true, true);
      } catch (e: any) {
        reply(false, null, e.message);
      }
      break;

    case 'saveComboSchedule':
      try {
        saveComboSchedule(payload.comboScheduleJsonString);
        reply(true, true);
      } catch (e: any) {
        reply(false, null, e.message);
      }
      break;

    default:
      reply(false, null, '未知的 action');
      break;
  }
}

onMounted(() => {
  chrome.runtime.onMessage.addListener(handleBridgeMessage);
});

onUnmounted(() => {
  chrome.runtime.onMessage.removeListener(handleBridgeMessage);
});
</script>

<template>
  <!-- Alert 弹窗 -->
  <var-dialog
    v-model:show="alertState.show"
    :title="alertState.title"
    :message="alertState.content"
    :confirm-button-text="alertState.confirmText"
    cancel-button-text="取消"
    confirm-button-color="var(--color-primary)"
    confirm-button-text-color="var(--color-on-primary)"
    @confirm="onAlertConfirm"
    @cancel="onAlertCancel"
    @closed="onAlertClosed"
  />

  <!-- Prompt 弹窗 -->
  <var-dialog
    v-model:show="promptState.show"
    :title="promptState.title"
    confirm-button-text="确定"
    cancel-button-text="取消"
    confirm-button-color="var(--color-primary)"
    confirm-button-text-color="var(--color-on-primary)"
    @before-close="onPromptBeforeClose"
  >
    <div style="display: flex; flex-direction: column; padding-top: 12px;">
      <var-input
        v-model="promptState.inputValue"
        variant="outlined"
        :placeholder="promptState.tip"
        autofocus
        @input="promptState.errorMsg = ''"
      />
      <div v-if="promptState.errorMsg" style="color: var(--color-danger); font-size: 12px; margin-top: 4px;">
        {{ promptState.errorMsg }}
      </div>
    </div>
  </var-dialog>

  <!-- SingleSelection 弹窗 -->
  <var-dialog
    v-model:show="selectionState.show"
    :title="selectionState.title"
    confirm-button-text="确定"
    cancel-button-text="取消"
    confirm-button-color="var(--color-primary)"
    confirm-button-text-color="var(--color-on-primary)"
    @before-close="onSelectionBeforeClose"
  >
    <div style="max-height: 50vh; overflow-y: auto; padding: 8px 0; width: 100%;">
      <var-radio-group v-model="selectionState.selectedIndex" direction="vertical" style="width: 100%;">
        <var-radio
          v-for="(item, index) in selectionState.items"
          :key="index"
          :checked-value="index"
          style="width: 100%; padding: 12px 16px; box-sizing: border-box;"
        >
          {{ item }}
        </var-radio>
      </var-radio-group>
    </div>
  </var-dialog>
</template>