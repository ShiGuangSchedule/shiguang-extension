// src/modules/session/session.ts

import type { ImportSession, WsAdapterPayload } from './types';

/**
 * WS 推送过来的当前 payload。
 * 由 background 在 WS 推送到达时写入；WS 断开时清空。
 * 跟随插件生命周期，不落盘。
 */
let currentWsPayload: WsAdapterPayload | null = null;

/**
 * 当前会话。
 * 开始导入时创建；导入结束 / 被终止时置空。
 */
let currentSession: ImportSession | null = null;

// ---------------------------------------------------------------------------
// WS payload 读写
// ---------------------------------------------------------------------------

export function getWsPayload(): WsAdapterPayload | null {
  return currentWsPayload;
}

export function setWsPayload(payload: WsAdapterPayload | null): void {
  currentWsPayload = payload;
}

export function hasWsPayload(): boolean {
  return currentWsPayload !== null;
}

// ---------------------------------------------------------------------------
// 会话读写
// ---------------------------------------------------------------------------

export function getSession(): ImportSession | null {
  return currentSession;
}

export function startSession(session: ImportSession): void {
  currentSession = session;
}

/**
 * 结束当前会话。
 * 返回被结束的会话（供调用方拿 tabId 去发 ABORT）；
 * 如果当前没有会话，返回 null。
 */
export function endSession(): ImportSession | null {
  const s = currentSession;
  currentSession = null;
  return s;
}