// src/modules/adapter-export/session.ts
import type {
  ImportCourseJsonModel,
  TimeSlotJsonModel,
  CourseConfigJsonModel,
  ComboScheduleJsonModel,
  CourseTableImportModel,
  PublicScheduleTemplateJsonModel,
} from './types';
import {
  pickCourse,
  pickTimeSlot,
  pickConfig,
  pickComboSchedule,
  validateTimeSlotsOrThrow,
  validateCustomCourseTimeOrThrow,
} from './validators';

// 当前适配任务的会话缓存
let cachedCourses: ImportCourseJsonModel[] | null = null;
let cachedTimeSlots: TimeSlotJsonModel[] | null = null;
let cachedConfig: CourseConfigJsonModel | null = null;
let cachedComboSchedule: ComboScheduleJsonModel | null = null;

// 基础时间段骨架，供作息方案对齐使用
let latestPresetTimeSlots: TimeSlotJsonModel[] | null = null;
// 作息方案已导入标记，用于拦截后续基础时间段导入
let isComboScheduleImported = false;

/** 保存导入课程，多次调用直接覆盖 */
export function saveImportedCourses(jsonString: string): void {
  const raw = parseJsonArray(jsonString, '课程列表');
  const courses = raw.map((item) => pickCourse(item));

  for (const course of courses) {
    validateCustomCourseTimeOrThrow(course);
  }

  cachedCourses = courses;
}

/** 保存预设时间段，多次调用直接覆盖，并刷新对齐骨架 */
export function savePresetTimeSlots(jsonString: string): void {
  if (isComboScheduleImported) {
    throw new Error('顺序拦截：已导入作息方案，禁止再调用基础时间导入以防覆盖方案状态');
  }

  const raw = parseJsonArray(jsonString, '时间段列表');
  const slots = raw.map((item) => pickTimeSlot(item));

  validateTimeSlotsOrThrow(slots);

  const sorted = [...slots].sort((a, b) => a.number - b.number);
  cachedTimeSlots = sorted;
  latestPresetTimeSlots = sorted;
}

/** 保存课表配置，多次调用直接覆盖 */
export function saveCourseConfig(jsonString: string): void {
  const raw = parseJsonValue(jsonString, '课表配置');
  cachedConfig = pickConfig(raw);
}

/** 保存组合作息方案，依赖基础时间段骨架做差量对齐 */
export function saveComboSchedule(jsonString: string): void {
  if (!latestPresetTimeSlots || latestPresetTimeSlots.length === 0) {
    throw new Error('顺序拦截：saveComboSchedule 必须在 savePresetTimeSlots 成功后调用');
  }

  const raw = parseJsonValue(jsonString, '作息方案');
  const combo = pickComboSchedule(raw);
  const base = latestPresetTimeSlots;

  const alignedTemplates = combo.publicSchedules.map((tpl) => alignTimeSlots(base, tpl));
  for (const tpl of alignedTemplates) {
    validateTimeSlotsOrThrow(tpl.timeSlots);
  }

  cachedComboSchedule = { ...combo, publicSchedules: alignedTemplates };
  isComboScheduleImported = true;
}

/**
 * 组装当前会话的导出数据。
 * 只返回可序列化对象，不做任何 IO。
 * 保留适配器明确传入的 null（与"未传"语义不同）。
 */
export function buildExportPayload(): CourseTableImportModel {
  if (!cachedCourses || cachedCourses.length === 0) {
    throw new Error('导出失败：没有课程数据（未调用 saveImportedCourses 或数据为空）');
  }

  const payload: CourseTableImportModel = { courses: cachedCourses };
  if (cachedTimeSlots && cachedTimeSlots.length > 0) payload.timeSlots = cachedTimeSlots;
  if (cachedConfig && Object.keys(cachedConfig).length > 0) payload.config = cachedConfig;
  if (cachedComboSchedule) payload.comboSchedule = cachedComboSchedule;

  return payload;
}

/** 清理会话状态，导出完成或用户取消时调用 */
export function resetSession(): void {
  cachedCourses = null;
  cachedTimeSlots = null;
  cachedConfig = null;
  cachedComboSchedule = null;
  latestPresetTimeSlots = null;
  isComboScheduleImported = false;
}

/** 当前是否持有任意缓存数据 */
export function hasCachedData(): boolean {
  return !!(
    cachedCourses ||
    cachedTimeSlots ||
    cachedConfig ||
    cachedComboSchedule
  );
}

// ---------------------------------------------------------------------------
// 内部工具
// ---------------------------------------------------------------------------

/**
 * 差量对齐：
 * 以 base 的 number 集合为骨架，模板有则覆盖 startTime/endTime，缺失则用骨架补齐，
 * 模板多出的 number 直接丢弃，合并后 alias 一律不产出。
 */
function alignTimeSlots(
  base: TimeSlotJsonModel[],
  template: PublicScheduleTemplateJsonModel,
): PublicScheduleTemplateJsonModel {
  const draftMap = new Map<number, TimeSlotJsonModel>();
  for (const s of template.timeSlots) {
    draftMap.set(s.number, s);
  }

  const merged: TimeSlotJsonModel[] = base.map((baseSlot) => {
    const draft = draftMap.get(baseSlot.number);
    return {
      number: baseSlot.number,
      startTime: draft ? draft.startTime : baseSlot.startTime,
      endTime: draft ? draft.endTime : baseSlot.endTime,
    };
  });

  return { ...template, timeSlots: merged };
}

function parseJsonArray(jsonString: string, label: string): unknown[] {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonString);
  } catch (e: any) {
    throw new Error(`${label} JSON 解析失败: ${e.message}`);
  }
  if (!Array.isArray(raw)) {
    throw new Error(`${label}必须是数组`);
  }
  return raw;
}

function parseJsonValue(jsonString: string, label: string): unknown {
  try {
    return JSON.parse(jsonString);
  } catch (e: any) {
    throw new Error(`${label} JSON 解析失败: ${e.message}`);
  }
}