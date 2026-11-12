// src/composables/useSidepanelToast.ts
import { reactive } from 'vue';

export interface ToastItem {
  id: number;
  message: string;
}

interface ToastState {
  current: ToastItem | null;
  visible: boolean;
  queue: ToastItem[];
}

/** 队列最后一条停留时长 */
const FINAL_DURATION = 3000;
/** 链式切换间隔（非最后一条） */
const CHAIN_DURATION = 500;
/** 淡出动画时长，需与 .sidepanel-toast-fade-leave-active 保持一致 */
const EXIT_DURATION = 200;

const state = reactive<ToastState>({
  current: null,
  visible: false,
  queue: [],
});

let uid = 0;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let exitTimer: ReturnType<typeof setTimeout> | null = null;
let currentIsFinal = false;

function clearTimers() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (exitTimer) {
    clearTimeout(exitTimer);
    exitTimer = null;
  }
}

/** 等 delay → 淡出 → 等动画结束 → 下一条 */
function scheduleFadeOutThenNext(delay: number) {
  if (hideTimer) clearTimeout(hideTimer);
  if (exitTimer) clearTimeout(exitTimer);
  hideTimer = setTimeout(() => {
    hideTimer = null;
    state.visible = false;
    exitTimer = setTimeout(() => {
      exitTimer = null;
      playNext();
    }, EXIT_DURATION);
  }, delay);
}

function playNext() {
  clearTimers();

  if (state.queue.length === 0) {
    state.current = null;
    state.visible = false;
    currentIsFinal = false;
    return;
  }

  const next = state.queue.shift()!;
  state.current = next;
  state.visible = true;
  currentIsFinal = state.queue.length === 0;

  if (currentIsFinal) {
    // 最后一条：停留 3s 后淡出
    scheduleFadeOutThenNext(FINAL_DURATION);
  } else {
    // 链式：0.5s 后原地替换成下一条（不淡出）
    hideTimer = setTimeout(() => {
      hideTimer = null;
      playNext();
    }, CHAIN_DURATION);
  }
}

/**
 * 命令式调用入口。
 * 可在任何扩展上下文（Vue 组件、BridgeUI、content 回调等）中 import 使用。
 */
export function showSidepanelToast(message: string) {
  if (!message) return;

  state.queue.push({ id: ++uid, message });

  // 空闲状态：立即播放
  if (!state.current) {
    playNext();
    return;
  }

  // 当前正在 3s 停留期，新消息插队 → 降级为链式（最多再显示 0.5s 后让位）
  if (currentIsFinal && state.visible) {
    currentIsFinal = false;
    scheduleFadeOutThenNext(CHAIN_DURATION);
  }
}

/** 组件内取响应式状态用 */
export function useSidepanelToast() {
  return state;
}

/** 手动清空（例如切换 tab / 关闭侧边栏时） */
export function clearSidepanelToast() {
  clearTimers();
  state.queue.length = 0;
  state.current = null;
  state.visible = false;
  currentIsFinal = false;
}