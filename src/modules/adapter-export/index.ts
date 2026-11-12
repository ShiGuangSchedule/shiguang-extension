// src/modules/adapter-export/index.ts

// 类型
export type {
  ImportCourseJsonModel,
  TimeSlotJsonModel,
  CourseConfigJsonModel,
  PublicScheduleTemplateJsonModel,
  ComboScheduleJsonModel,
  CourseTableImportModel,
} from './types';

// 会话数据层
export {
  saveImportedCourses,
  savePresetTimeSlots,
  saveCourseConfig,
  saveComboSchedule,
  buildExportPayload,
  resetSession,
  hasCachedData,
} from './session';

// 输出通道：文件
export {
  downloadJsonFile,
  buildDefaultFilename,
} from './exporters/file';