// src/modules/ws/state.ts
import { reactive } from 'vue';

export const wsState = reactive({
  /** 当前是否已连接 */
  isConnected: false,
  /** 桌面端下发的软件版本号 */
  appVersion: '',
  /** 桌面端下发的平台名称 */
  platform: '',
});