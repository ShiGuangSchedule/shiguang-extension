// src/modules/adapter-export/validators.ts
import type {
  ImportCourseJsonModel,
  TimeSlotJsonModel,
  CourseConfigJsonModel,
  ComboScheduleJsonModel,
  PublicScheduleTemplateJsonModel,
} from './types';

const TIME_REGEX = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// 读取 + 类型校验 + 报错，一次完成

function readString(o: Record<string, unknown>, key: string, path: string): string {
  const v = o[key];
  if (typeof v !== 'string') throw new Error(`${path}.${key} 类型错误，期望 string`);
  return v;
}

function readNumber(o: Record<string, unknown>, key: string, path: string): number {
  const v = o[key];
  if (typeof v !== 'number') throw new Error(`${path}.${key} 类型错误，期望 number`);
  return v;
}

function readBoolean(o: Record<string, unknown>, key: string, path: string): boolean {
  const v = o[key];
  if (typeof v !== 'boolean') throw new Error(`${path}.${key} 类型错误，期望 boolean`);
  return v;
}

function readStringOrNull(o: Record<string, unknown>, key: string, path: string): string | null {
  const v = o[key];
  if (v !== null && typeof v !== 'string') throw new Error(`${path}.${key} 类型错误，期望 string 或 null`);
  return v;
}

function readNumberOrNull(o: Record<string, unknown>, key: string, path: string): number | null {
  const v = o[key];
  if (v !== null && typeof v !== 'number') throw new Error(`${path}.${key} 类型错误，期望 number 或 null`);
  return v;
}

function readNumberArray(o: Record<string, unknown>, key: string, path: string): number[] {
  const v = o[key];
  if (!Array.isArray(v) || !v.every((x) => typeof x === 'number')) {
    throw new Error(`${path}.${key} 必须是 number 数组`);
  }
  return v;
}

// 白名单提取

/**
 * 课程项白名单提取，额外字段一律丢弃。
 *
 * 条件必填规则：
 * - isCustomTime 为 true：customStartTime / customEndTime 必填，startSection / endSection 可忽略
 * - isCustomTime 为 false 或未提供：startSection / endSection 必填，customStartTime / customEndTime 可忽略
 *
 * 不传与传默认值语义不同：
 * - 未传：字段不出现在结果中
 * - 传了值（含 null、false）：原样保留
 */
export function pickCourse(raw: unknown): ImportCourseJsonModel {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('课程项必须是对象');
  }
  const o = raw as Record<string, unknown>;
  const label = `课程"${readString(o, 'name', '课程')}"`;

  const isCustomTime = 'isCustomTime' in o ? readBoolean(o, 'isCustomTime', label) : false;

  const result = {} as ImportCourseJsonModel;
  result.name = readString(o, 'name', label);
  result.teacher = readString(o, 'teacher', label);
  result.position = readString(o, 'position', label);
  result.day = readNumber(o, 'day', label);

  // startSection：isCustomTime 为 false 时必填
  if (isCustomTime) {
    if ('startSection' in o) result.startSection = readNumberOrNull(o, 'startSection', label);
  } else {
    if (!('startSection' in o) || o.startSection === null) {
      throw new Error(`${label}.startSection 必填（isCustomTime 为 false 或未提供时）`);
    }
    result.startSection = readNumber(o, 'startSection', label);
  }

  // endSection：isCustomTime 为 false 时必填
  if (isCustomTime) {
    if ('endSection' in o) result.endSection = readNumberOrNull(o, 'endSection', label);
  } else {
    if (!('endSection' in o) || o.endSection === null) {
      throw new Error(`${label}.endSection 必填（isCustomTime 为 false 或未提供时）`);
    }
    result.endSection = readNumber(o, 'endSection', label);
  }

  result.weeks = readNumberArray(o, 'weeks', label);

  if ('isCustomTime' in o) result.isCustomTime = isCustomTime;

  // customStartTime：isCustomTime 为 true 时必填
  if (isCustomTime) {
    if (!('customStartTime' in o) || o.customStartTime === null) {
      throw new Error(`${label}.customStartTime 必填（isCustomTime 为 true 时）`);
    }
    result.customStartTime = readString(o, 'customStartTime', label);
  } else {
    if ('customStartTime' in o) result.customStartTime = readStringOrNull(o, 'customStartTime', label);
  }

  // customEndTime：isCustomTime 为 true 时必填
  if (isCustomTime) {
    if (!('customEndTime' in o) || o.customEndTime === null) {
      throw new Error(`${label}.customEndTime 必填（isCustomTime 为 true 时）`);
    }
    result.customEndTime = readString(o, 'customEndTime', label);
  } else {
    if ('customEndTime' in o) result.customEndTime = readStringOrNull(o, 'customEndTime', label);
  }

  if ('credit' in o) result.credit = readNumberOrNull(o, 'credit', label);

  return result;
}

/** 时间段白名单提取，alias 教务适配无效，始终丢弃 */
export function pickTimeSlot(raw: unknown): TimeSlotJsonModel {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('时间段项必须是对象');
  }
  const o = raw as Record<string, unknown>;
  const number = readNumber(o, 'number', '时间段');
  const label = `时间段 ${number}`;

  return {
    number,
    startTime: readString(o, 'startTime', label),
    endTime: readString(o, 'endTime', label),
  };
}

/** 课表配置白名单提取，不传省略，传则原样保留 */
export function pickConfig(raw: unknown): CourseConfigJsonModel {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('课表配置必须是对象');
  }
  const o = raw as Record<string, unknown>;
  const result: CourseConfigJsonModel = {};

  if ('semesterStartDate' in o) result.semesterStartDate = readStringOrNull(o, 'semesterStartDate', 'config');
  if ('semesterTotalWeeks' in o) result.semesterTotalWeeks = readNumber(o, 'semesterTotalWeeks', 'config');
  if ('defaultClassDuration' in o) result.defaultClassDuration = readNumber(o, 'defaultClassDuration', 'config');
  if ('defaultBreakDuration' in o) result.defaultBreakDuration = readNumber(o, 'defaultBreakDuration', 'config');
  if ('firstDayOfWeek' in o) result.firstDayOfWeek = readNumber(o, 'firstDayOfWeek', 'config');

  return result;
}

/** 组合作息方案白名单提取，不传省略，传则原样保留 */
export function pickComboSchedule(raw: unknown): ComboScheduleJsonModel {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('作息方案必须是对象');
  }
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.publicSchedules)) {
    throw new Error('作息方案 publicSchedules 必须是数组');
  }

  const result = {} as ComboScheduleJsonModel;
  if ('name' in o) result.name = readStringOrNull(o, 'name', 'comboSchedule');
  result.publicSchedules = o.publicSchedules.map((t, i) => pickPublicTemplate(t, i));

  return result;
}

function pickPublicTemplate(raw: unknown, index: number): PublicScheduleTemplateJsonModel {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`第 ${index + 1} 个公共作息模板必须是对象`);
  }
  const o = raw as Record<string, unknown>;
  const label = `第 ${index + 1} 个公共作息模板"${readString(o, 'name', `第 ${index + 1} 个公共作息模板`)}"`;

  if (!Array.isArray(o.timeSlots)) {
    throw new Error(`${label}.timeSlots 必须是数组`);
  }

  const result = {} as PublicScheduleTemplateJsonModel;
  result.name = readString(o, 'name', label);
  result.startDate = readString(o, 'startDate', label);
  result.endDate = readString(o, 'endDate', label);
  if ('defaultClassDuration' in o) result.defaultClassDuration = readNumber(o, 'defaultClassDuration', label);
  if ('defaultBreakDuration' in o) result.defaultBreakDuration = readNumber(o, 'defaultBreakDuration', label);
  result.timeSlots = o.timeSlots.map((s) => pickTimeSlot(s));

  return result;
}

// 校验

/**
 * 校验时间段列表。
 * 1. number 从 1 开始且连续递增
 * 2. startTime / endTime 匹配 "HH:mm"
 * 3. startTime 必须早于 endTime
 * 4. 相邻时段不允许重叠
 */
export function validateTimeSlotsOrThrow(timeSlots: TimeSlotJsonModel[]): void {
  if (timeSlots.length === 0) return;

  const sorted = [...timeSlots].sort((a, b) => a.number - b.number);
  let lastEndInMinutes = -1;

  for (let i = 0; i < sorted.length; i++) {
    const slot = sorted[i];
    const expectedNumber = i + 1;

    if (slot.number !== expectedNumber) {
      throw new Error(`时间段编号不连续或未从 1 开始（期望 ${expectedNumber}，实际 ${slot.number}）`);
    }
    if (!TIME_REGEX.test(slot.startTime) || !TIME_REGEX.test(slot.endTime)) {
      throw new Error(`时间段 ${slot.number} 时间格式错误（应为 HH:mm）`);
    }

    const startMin = timeToMinutes(slot.startTime);
    const endMin = timeToMinutes(slot.endTime);

    if (startMin >= endMin) {
      throw new Error(`时间段 ${slot.number} 开始时间必须早于结束时间`);
    }
    if (lastEndInMinutes !== -1 && startMin < lastEndInMinutes) {
      throw new Error(`时间段 ${slot.number} 与上一节时间重叠`);
    }
    lastEndInMinutes = endMin;
  }
}

/** 校验课程自定义时间，仅当 isCustomTime 为 true 时生效 */
export function validateCustomCourseTimeOrThrow(course: ImportCourseJsonModel): void {
  if (course.isCustomTime !== true) return;

  const start = course.customStartTime;
  const end = course.customEndTime;

  if (!start || !start.trim() || !end || !end.trim()) {
    throw new Error(`课程"${course.name}"自定义时间不能为空`);
  }
  if (!TIME_REGEX.test(start) || !TIME_REGEX.test(end)) {
    throw new Error(`课程"${course.name}"自定义时间格式错误（应为 HH:mm）`);
  }
  if (timeToMinutes(start) >= timeToMinutes(end)) {
    throw new Error(`课程"${course.name}"自定义开始时间必须早于结束时间`);
  }
}