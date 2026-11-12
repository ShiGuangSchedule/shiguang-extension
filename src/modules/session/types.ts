// src/modules/session/types.ts

/**
 * 当前导入会话。
 * 一次会话 = 从“开始导入”到“结束/中断”。
 */
export interface ImportSession {
  /** 会话所在的目标 tab ID */
  tabId: number;
  /** 这次会话用的模式 */
  mode: 'ws' | 'local';
  /** 本地模式下是哪个适配器 ID；WS 模式下为空 */
  adapterId?: string;
}

/**
 * WS 推送过来的当前适配器负载数据。
 */
export interface WsAdapterPayload {
  url: string;
  code: string;
}

/**
 * WebSocket 状态结构
 */
export interface WsStatus {
  connected: boolean;
  payload: WsAdapterPayload | null;
}