// src/modules/ws/index.ts
export type { ExtensionBridgeMessage } from './protocol';
export { wsState } from './state';
export { connect, connectWith, disconnect } from './client';
export { send, sendCourseTableResult } from './messages';