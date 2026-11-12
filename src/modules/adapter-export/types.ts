// src/modules/adapter-export/types.ts
/**
 * 课表数据的 JSON 导入契约。
 *
 * 本类型仅描述"允许出现在最终 JSON"的字段，
 * 适配器传入的额外字段（color / remark / alias 等）在白名单提取阶段被丢弃。
 */

/** 课程项 */
export interface ImportCourseJsonModel {
  name: string;
  teacher: string;
  position: string;
  day: number;
  startSection?: number | null;
  endSection?: number | null;
  weeks: number[];
  isCustomTime?: boolean;
  customStartTime?: string | null;
  customEndTime?: string | null;
  credit?: number | null;
}

/** 时间段 */
export interface TimeSlotJsonModel {
  number: number;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
}

/** 课表配置 */
export interface CourseConfigJsonModel {
  semesterStartDate?: string | null; // "YYYY-MM-DD"
  semesterTotalWeeks?: number;
  defaultClassDuration?: number;
  defaultBreakDuration?: number;
  firstDayOfWeek?: number;
}

/** 公共作息模板 */
export interface PublicScheduleTemplateJsonModel {
  name: string;
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD"
  defaultClassDuration?: number;
  defaultBreakDuration?: number;
  timeSlots: TimeSlotJsonModel[];
}

/** 组合作息方案 */
export interface ComboScheduleJsonModel {
  name?: string | null;
  publicSchedules: PublicScheduleTemplateJsonModel[];
}

/**
 * 最终导出结构。
 *
 * courses 必填；timeSlots / config / comboSchedule 可选。
 * timeSlots 的可空是工具适配的豁免
 */
export interface CourseTableImportModel {
  courses: ImportCourseJsonModel[];
  timeSlots?: TimeSlotJsonModel[];
  config?: CourseConfigJsonModel;
  comboSchedule?: ComboScheduleJsonModel;
}