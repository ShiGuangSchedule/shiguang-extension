// src/modules/ws/connection.ts

/** 连接生命周期回调 */
export interface ConnectionHandlers {
  onOpen?: () => void;
  onMessage?: (text: string) => void;
  onClose?: (code: number, reason: string) => void;
  onError?: (event: Event) => void;
}

export class WsConnection {
  private ws: WebSocket | null = null;

  isOpen(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /** 建立连接。返回的 Promise 在连接成功时 resolve，失败时 reject */
  open(url: string, handlers: ConnectionHandlers): Promise<void> {
    this.close();

    return new Promise((resolve, reject) => {
      let isResolved = false;
      const ws = new WebSocket(url);

      ws.onopen = () => {
        handlers.onOpen?.();
        isResolved = true;
        resolve();
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          handlers.onMessage?.(event.data);
        }
      };

      ws.onclose = (event) => {
        this.ws = null;
        handlers.onClose?.(event.code, event.reason);
        if (!isResolved) {
          reject(new Error(`连接已断开 (code=${event.code})`));
        }
      };

      ws.onerror = (event) => {
        handlers.onError?.(event);
        if (!isResolved) {
          reject(new Error('无法连接到服务器'));
        }
      };

      this.ws = ws;
    });
  }

  send(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket 未连接');
    }
    this.ws.send(text);
  }

  close(): void {
    if (!this.ws) return;
    this.ws.onopen = null;
    this.ws.onmessage = null;
    this.ws.onclose = null;
    this.ws.onerror = null;
    try {
      this.ws.close();
    } catch {}
    this.ws = null;
  }
}

export const wsConnection = new WsConnection();