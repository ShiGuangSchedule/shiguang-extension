// src/modules/ws/protocol.ts

/**
 * 桌面端与插件之间的统一消息信封。
 *
 * 桌面端（Kotlin）使用 kotlinx.serialization，encodeDefaults = false，
 * 因此值为默认值的字段（id="" / apiKey=null / code=200 / message=null）不会出现在 JSON 中。
 * 所有字段按"接收端可能读不到"处理为可选，只有 action 必填。
 */
export interface ExtensionBridgeMessage<P extends Record<string, unknown> = Record<string, unknown>> {
  /** 消息唯一标识。桌面端发送时总是生成 UUID；插件侧接收时可选 */
  id?: string;

  /** 业务动作类型 */
  action: string;

  /** 双向鉴权密钥。桌面端接收插件消息时校验，不匹配直接丢弃 */
  apiKey?: string | null;

  /** 业务数据载体，必须是 JSON 对象（对应 Kotlin 的 JsonObject） */
  payload?: P | null;

  /** 状态码。桌面端默认 200，值为 200 时不序列化 */
  code?: number;

  /** 附加提示或错误信息 */
  message?: string | null;
}