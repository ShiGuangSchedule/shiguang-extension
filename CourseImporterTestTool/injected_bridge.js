// injected_bridge.js

// Promise ID 生成器
function generatePromiseId() {
    return Date.now() + '-' + Math.random().toString(36).substring(2, 15);
}

// 待处理 Promise 存储
const pendingPromises = new Map();

let presetTimeSlotsCache = null;

let isComboScheduleImported = false;

// shiguangBridge 同步方法模拟
window.shiguangBridge = {
    showToast: (message) => {
        console.log('[模拟Toast]:', message);
        window.postMessage({ type: 'ANDROID_BRIDGE_CALL', method: 'showToast', args: [message] }, window.location.origin);
    },
    // 统一的收尾信号
    notifyTaskCompletion: () => {
        console.log('[模拟Completion]: 收到任务完成通知');
        presetTimeSlotsCache = null;
        isComboScheduleImported = false;
        window.postMessage({ type: 'ANDROID_BRIDGE_CALL', method: 'notifyTaskCompletion', args: [] }, window.location.origin);
    }
};

// 严格的 HH:mm 正则表达式：小时 00-23，分钟 00-59
const TIME_REGEX = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;

// 严格的 YYYY-MM-DD 正则表达式
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 辅助函数：将 "HH:mm" 格式的字符串转换为自午夜以来的分钟数。
 * 如果格式不正确返回 -1。
 */
function parseTimeToMinutes(timeStr) {
    if (!timeStr || !TIME_REGEX.test(timeStr)) return -1;
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    return hours * 60 + minutes;
}

/**
 * 验证单个课程数据是否包含所有必需字段。
 * @param {object} course 待验证的课程对象
 * @returns {string|null} 如果验证失败返回错误消息，否则返回 null
 */
function validateCourseData(course) {
    if (!course) {
        return "课程数据必须是一个有效的对象。";
    }
    const requiredFields = ['name', 'teacher', 'position', 'day', 'weeks'];
    // 如果开启了自定义时间，强校验 customStartTime 和 customEndTime
    if (course.isCustomTime) {
        const startTime = course.customStartTime;
        const endTime = course.customEndTime;

        if (!startTime || typeof startTime !== 'string' || startTime.trim() === '') return "自定义时间课程缺少 customStartTime 字段。";
        if (!endTime || typeof endTime !== 'string' || endTime.trim() === '') return "自定义时间课程缺少 customEndTime 字段。";

        const startMinutes = parseTimeToMinutes(startTime);
        const endMinutes = parseTimeToMinutes(endTime);

        if (startMinutes === -1 || endMinutes === -1) {
            return "自定义时间格式错误";
        }
        if (startMinutes >= endMinutes) {
            return "自定义开始时间必须早于结束时间";
        }
    } else {
        // If not custom time, startSection and endSection are required
        if (course.startSection === undefined || course.startSection === null) {
            return `课程数据缺少必需字段: 'startSection'。`;
        }
        if (course.endSection === undefined || course.endSection === null) {
            return `课程数据缺少必需字段: 'endSection'。`;
        }
    }
    for (const field of requiredFields) {
        if (course[field] === undefined || course[field] === null) {
            return `课程数据缺少必需字段: '${field}'。`;
        }
    }
    // 额外的非空字符串检查
    if (typeof course.name === 'string' && course.name.trim() === '') {
        return "课程名称不能为空。";
    }
    return null;
}

/**
 * 验证整个预设时间段数组（强校验格式、递增连续性、不重叠）。
 * @param {Array} timeSlots 待验证的时间段数组
 * @returns {string|null} 如果验证失败返回错误消息，否则返回 null
 */
function validateAllTimeSlots(timeSlots) {
    if (!Array.isArray(timeSlots)) {
        return "传入的JSON不是一个时间段数组。";
    }
    if (timeSlots.length === 0) return null;

    const sortedSlots = [...timeSlots].sort((a, b) => (a.number || 0) - (b.number || 0));
    let lastEndTimeInMinutes = -1;

    for (let i = 0; i < sortedSlots.length; i++) {
        const slot = sortedSlots[i];
        const expectedNumber = i + 1;
        if (slot.number !== expectedNumber) {
            return "时间段编号不连续或未从1开始";
        }

        if (!slot.startTime || !slot.endTime) {
            return "时间段数据缺少必需字段";
        }

        const startMinutes = parseTimeToMinutes(slot.startTime);
        const endMinutes = parseTimeToMinutes(slot.endTime);

        if (startMinutes === -1 || endMinutes === -1) {
            return "时间格式错误";
        }

        if (startMinutes >= endMinutes) {
            return "开始时间必须早于结束时间";
        }

        if (lastEndTimeInMinutes !== -1 && startMinutes < lastEndTimeInMinutes) {
            return "时间段配置存在重叠";
        }

        lastEndTimeInMinutes = endMinutes;
    }
    return null;
}

/**
 * 验证并清洗课表配置数据，应用默认值并忽略多余字段。
 *
 * 实现了以下逻辑:
 * 1. 确保是有效的 JSON 对象。
 * 2. 忽略未在模型中定义的字段。
 * 3. 对缺失的字段应用模型中定义的默认值。
 * 4. 对数字字段进行基本类型检查。
 *
 * @param {string} jsonString 待验证的配置 JSON 字符串
 * @returns {string} 清洗和补全默认值后的 JSON 字符串
 */
function validateCourseConfigData(jsonString) {
    let config;
    try {
        config = JSON.parse(jsonString);
    } catch (e) {
        throw new Error(`配置数据 JSON 解析失败: ${e.message}`);
    }

    if (typeof config !== 'object' || config === null) {
        throw new Error("传入的配置数据不是一个有效的JSON对象。");
    }

    // 预期模型的字段及其默认值 (基于 CourseConfigJsonModel)
    const defaults = {
        semesterStartDate: null, // String? = null
        semesterTotalWeeks: 20, // Int = 20
        defaultClassDuration: 45, // Int = 45
        defaultBreakDuration: 10, // Int = 10
        firstDayOfWeek: 1 // Int = 1
    };

    const cleanedConfig = {};
    let errorMsg = null;

    // 清洗和应用默认值
    for (const key in defaults) {
        const defaultValue = defaults[key];

        if (config.hasOwnProperty(key)) {
            let value = config[key];

            // 针对 Int 类型的字段进行类型检查和转换 (除了 null 值的 semesterStartDate)
            if (typeof defaultValue === 'number') {
                // 尝试转换为整数
                let numValue = parseInt(value);
                if (isNaN(numValue) || numValue < 0) {
                    errorMsg = `'${key}' 必须是有效的非负整数。`;
                    break;
                }
                cleanedConfig[key] = numValue;
            } else if (key === 'semesterStartDate') {
                // 确保是字符串或 null
                if (value !== null && typeof value !== 'string') {
                     errorMsg = `'${key}' 必须是字符串或 null。`;
                     break;
                }
                cleanedConfig[key] = value;
            } else {
                // 对于其他类型（理论上不应该有），直接使用值
                cleanedConfig[key] = value;
            }
        } else {
            // 字段缺失，应用默认值
            cleanedConfig[key] = defaultValue;
        }
    }
    
    if (errorMsg) {
        throw new Error(`配置数据验证失败: ${errorMsg}`);
    }

    // 返回清洗和补全后的 JSON 字符串
    return JSON.stringify(cleanedConfig);
}

/**
 * 验证组合作息方案的数据结构。
 * 校验逻辑对齐文档《适配脚本开发指南 v2》1.4 节与《一些数据的格式信息.md》第四节。
 *
 * @param {object} combo 组合作息方案对象
 * @returns {string|null} 验证失败返回错误消息，否则返回 null
 */
function validateComboScheduleData(combo) {
    if (typeof combo !== 'object' || combo === null) {
        return "组合作息方案不是一个有效的 JSON 对象。";
    }
    if (!Array.isArray(combo.publicSchedules) || combo.publicSchedules.length === 0) {
        return "publicSchedules 必须是非空数组。";
    }

    for (const tpl of combo.publicSchedules) {
        if (!tpl || typeof tpl !== 'object') {
            return "公共作息模板必须是一个对象。";
        }
        if (!tpl.name || typeof tpl.name !== 'string' || tpl.name.trim() === '') {
            return "公共作息模板缺少 name 字段。";
        }
        if (!tpl.startDate || !tpl.endDate) {
            return `模板 ${tpl.name} 缺少 startDate 或 endDate。`;
        }
        if (!DATE_REGEX.test(tpl.startDate) || !DATE_REGEX.test(tpl.endDate)) {
            return `模板 ${tpl.name} 的日期格式错误，应为 YYYY-MM-DD。`;
        }
        if (!Array.isArray(tpl.timeSlots)) {
            return `模板 ${tpl.name} 的 timeSlots 必须是数组。`;
        }
        for (const slot of tpl.timeSlots) {
            if (!slot || typeof slot !== 'object') {
                return `模板 ${tpl.name} 中的节次必须是一个对象。`;
            }
            if (typeof slot.number !== 'number') {
                return `模板 ${tpl.name} 中的节次缺少 number 字段。`;
            }
            if (!slot.startTime || !slot.endTime) {
                return `模板 ${tpl.name} 的节次 ${slot.number} 缺少时间。`;
            }
            const sm = parseTimeToMinutes(slot.startTime);
            const em = parseTimeToMinutes(slot.endTime);
            if (sm === -1 || em === -1) {
                return `模板 ${tpl.name} 的节次 ${slot.number} 时间格式错误。`;
            }
            if (sm >= em) {
                return `模板 ${tpl.name} 的节次 ${slot.number} 开始时间必须早于结束时间。`;
            }
        }
    }
    return null;
}

/**
 * 差量合并：以基础时间段为骨架，对本模板的 timeSlots 做对齐。
 *
 * 规则（对齐文档 1.4 节「差量合并机制」）：
 * - 骨架中已有的 number：用模板提供的 startTime / endTime 覆盖；
 * - 骨架中缺失的 number：用骨架补齐；
 * - 模板中多出的 number：自动丢弃；
 * - 合并后 alias 统一置为 null（本地无 alias 概念，此处不写入）。
 *
 * @param {Array} baseSlots 基础时间段骨架（已按 number 升序）
 * @param {Array} draftSlots 模板提供的草稿时间段
 * @returns {Array} 合并后的时间段数组
 */
function mergeAndAlignTimeSlots(baseSlots, draftSlots) {
    const draftMap = new Map();
    for (const slot of draftSlots) {
        draftMap.set(slot.number, slot);
    }
    return baseSlots.map(base => {
        const override = draftMap.get(base.number);
        if (override) {
            return {
                number: base.number,
                startTime: override.startTime,
                endTime: override.endTime
            };
        }
        return {
            number: base.number,
            startTime: base.startTime,
            endTime: base.endTime
        };
    });
}

/**
 * 清洗课程对象：只保留文档定义的字段。
 * 丢弃的字段：color、remark 及任何未定义字段。
 * 对齐 Native 侧的 ignoreUnknownKeys 行为。
 *
 * @param {object} course 原始课程对象
 * @returns {object} 清洗后的课程对象
 */
function cleanCourseData(course) {
    const cleaned = {};
    if (course.name !== undefined) cleaned.name = course.name;
    if (course.teacher !== undefined) cleaned.teacher = course.teacher;
    if (course.position !== undefined) cleaned.position = course.position;
    if (course.day !== undefined) cleaned.day = course.day;
    if (course.startSection !== undefined) cleaned.startSection = course.startSection;
    if (course.endSection !== undefined) cleaned.endSection = course.endSection;
    if (course.weeks !== undefined) cleaned.weeks = course.weeks;
    if (course.isCustomTime !== undefined) cleaned.isCustomTime = course.isCustomTime;
    if (course.customStartTime !== undefined) cleaned.customStartTime = course.customStartTime;
    if (course.customEndTime !== undefined) cleaned.customEndTime = course.customEndTime;
    if (course.credit !== undefined) cleaned.credit = course.credit;
    return cleaned;
}

/**
 * 清洗时间段对象：只保留 number、startTime、endTime。
 * 丢弃的字段：alias 及任何未定义字段。
 *
 * @param {object} slot 原始时间段对象
 * @returns {object} 清洗后的时间段对象
 */
function cleanTimeSlotData(slot) {
    const cleaned = {};
    if (slot.number !== undefined) cleaned.number = slot.number;
    if (slot.startTime !== undefined) cleaned.startTime = slot.startTime;
    if (slot.endTime !== undefined) cleaned.endTime = slot.endTime;
    return cleaned;
}

/**
 * 清洗组合作息方案：顶层只保留 name、publicSchedules；
 * 模板只保留 name、startDate、endDate、defaultClassDuration、defaultBreakDuration、timeSlots。
 *
 * @param {object} combo 原始组合作息方案对象
 * @returns {object} 清洗后的组合作息方案对象
 */
function cleanComboScheduleData(combo) {
    const cleaned = {};
    if (combo.name !== undefined) cleaned.name = combo.name;
    cleaned.publicSchedules = (combo.publicSchedules || []).map(tpl => {
        const t = {};
        if (tpl.name !== undefined) t.name = tpl.name;
        if (tpl.startDate !== undefined) t.startDate = tpl.startDate;
        if (tpl.endDate !== undefined) t.endDate = tpl.endDate;
        if (tpl.defaultClassDuration !== undefined) t.defaultClassDuration = tpl.defaultClassDuration;
        if (tpl.defaultBreakDuration !== undefined) t.defaultBreakDuration = tpl.defaultBreakDuration;
        t.timeSlots = (tpl.timeSlots || []).map(cleanTimeSlotData);
        return t;
    });
    return cleaned;
}

// shiguangBridgePromise 异步方法模拟
window.shiguangBridgePromise = {
    showAlert: (titleText, contentText, confirmText) => {
        return new Promise((resolve, reject) => {
            const promiseId = generatePromiseId();
            pendingPromises.set(promiseId, { resolve, reject });
            console.log('[模拟Alert]:', { titleText, contentText, confirmText, promiseId });
            window.postMessage({
                type: 'ANDROID_BRIDGE_CALL',
                method: 'showAlert',
                args: [titleText, contentText, confirmText, promiseId],
                messageId: promiseId
            }, window.location.origin);
        });
    },

    showPrompt: (titleText, contentText, defaultValue, validatorFnName) => {
        return new Promise((resolve, reject) => {
            const promiseId = generatePromiseId();
            pendingPromises.set(promiseId, { resolve, reject });
            console.log('[模拟Prompt]:', { titleText, contentText, defaultValue, validatorFnName });
            window.postMessage({
                type: 'ANDROID_BRIDGE_CALL',
                method: 'showPrompt',
                args: [titleText, contentText, defaultValue, validatorFnName, promiseId],
                messageId: promiseId
            }, window.location.origin);
        });
    },

    showSingleSelection: (titleText, items, selectedIndex) => {
        return new Promise((resolve, reject) => {
            const promiseId = generatePromiseId();
            pendingPromises.set(promiseId, { resolve, reject });
            console.log('[模拟SingleSelection]:', { titleText, items, selectedIndex, promiseId });
            window.postMessage({
                type: 'ANDROID_BRIDGE_CALL',
                method: 'showSingleSelection',
                args: [titleText, items, selectedIndex],
                messageId: promiseId
            }, window.location.origin);
        });
    },

    saveImportedCourses: (jsonString) => {
        return new Promise((resolve, reject) => {
            const promiseId = generatePromiseId();
            pendingPromises.set(promiseId, { resolve, reject });
            console.log('[模拟SaveImportedCourses]:', { jsonString });

            let cleanedCourses;
            try {
                const courses = JSON.parse(jsonString);
                if (!Array.isArray(courses)) {
                    throw new Error("传入的JSON不是一个课程数组。");
                }
                for (const course of courses) {
                    const validationError = validateCourseData(course);
                    if (validationError) {
                        throw new Error(`课程数据验证失败: ${validationError}`);
                    }
                }
                // 校验通过后清洗：只保留文档定义的字段
                cleanedCourses = courses.map(cleanCourseData);
            } catch (e) {
                console.error('[数据验证失败]:', e.message);
                pendingPromises.delete(promiseId);
                return reject(e);
            }

            window.postMessage({
                type: 'ANDROID_BRIDGE_CALL',
                method: 'saveImportedCourses',
                args: [JSON.stringify(cleanedCourses), promiseId],
                messageId: promiseId
            }, window.location.origin);
        });
    },

    savePresetTimeSlots: (jsonString) => {
        return new Promise((resolve, reject) => {
            const promiseId = generatePromiseId();
            pendingPromises.set(promiseId, { resolve, reject });
            console.log('[模拟SavePresetTimeSlots]:', { jsonString });

            // 时序拦截：若已导入组合作息，禁止再调基础时间导入
            if (isComboScheduleImported) {
                const errMsg = "顺序拦截：已导入作息方案，禁止再调用基础时间导入以防覆盖方案状态。";
                console.error('[时序拦截]:', errMsg);
                pendingPromises.delete(promiseId);
                return reject(new Error(errMsg));
            }

            let cleanedTimeSlots;
            try {
                const timeSlots = JSON.parse(jsonString);
                const validationError = validateAllTimeSlots(timeSlots);
                if (validationError) {
                    throw new Error(validationError);
                }

                cleanedTimeSlots = timeSlots.map(cleanTimeSlotData);
            } catch (e) {
                console.error('[数据验证失败]:', e.message);
                pendingPromises.delete(promiseId);
                return reject(e);
            }

            presetTimeSlotsCache = [...cleanedTimeSlots].sort((a, b) => a.number - b.number);

            window.postMessage({
                type: 'ANDROID_BRIDGE_CALL',
                method: 'savePresetTimeSlots',
                args: [JSON.stringify(cleanedTimeSlots), promiseId],
                messageId: promiseId
            }, window.location.origin);
        });
    },

    saveCourseConfig: (jsonString) => {
        return new Promise((resolve, reject) => {
            const promiseId = generatePromiseId();
            pendingPromises.set(promiseId, { resolve, reject });
            console.log('[模拟SaveCourseConfig]:', { jsonString });
            
            let cleanedJsonString = jsonString;

            try {
                cleanedJsonString = validateCourseConfigData(jsonString);
            } catch (e) {
                console.error('[配置数据校验失败]:', e.message);
                pendingPromises.delete(promiseId);
                return reject(e);
            }

            window.postMessage({
                type: 'ANDROID_BRIDGE_CALL',
                method: 'saveCourseConfig',
                args: [cleanedJsonString, promiseId], 
                messageId: promiseId
            }, window.location.origin);
        });
    },

    // 组合作息方案提交
    saveComboSchedule: (jsonString) => {
        return new Promise((resolve, reject) => {
            const promiseId = generatePromiseId();
            pendingPromises.set(promiseId, { resolve, reject });
            console.log('[模拟SaveComboSchedule]:', { jsonString });

            // 前置检查：必须先成功调用 savePresetTimeSlots
            if (!presetTimeSlotsCache || presetTimeSlotsCache.length === 0) {
                const errMsg = "顺序拦截：saveComboSchedule 必须在 savePresetTimeSlots 执行成功后调用！";
                console.error('[时序拦截]:', errMsg);
                pendingPromises.delete(promiseId);
                return reject(new Error(errMsg));
            }

            let combo;
            try {
                combo = JSON.parse(jsonString);
            } catch (e) {
                console.error('[组合作息方案 JSON 解析失败]:', e.message);
                pendingPromises.delete(promiseId);
                return reject(new Error(`组合作息方案 JSON 解析失败: ${e.message}`));
            }

            // 字段校验
            const validationError = validateComboScheduleData(combo);
            if (validationError) {
                console.error('[组合作息方案数据校验失败]:', validationError);
                pendingPromises.delete(promiseId);
                return reject(new Error(validationError));
            }

            const cleanedCombo = cleanComboScheduleData(combo);

            // 差量合并：每个模板的 timeSlots 对齐到骨架
            const mergedCombo = {
                name: (typeof cleanedCombo.name === 'string' && cleanedCombo.name.trim() !== '')
                    ? cleanedCombo.name
                    : null,
                publicSchedules: cleanedCombo.publicSchedules.map(tpl => ({
                    name: tpl.name,
                    startDate: tpl.startDate,
                    endDate: tpl.endDate,
                    defaultClassDuration: tpl.defaultClassDuration,
                    defaultBreakDuration: tpl.defaultBreakDuration,
                    timeSlots: mergeAndAlignTimeSlots(presetTimeSlotsCache, tpl.timeSlots || [])
                }))
            };

            // 标记已导入组合作息，锁定后续 savePresetTimeSlots
            isComboScheduleImported = true;

            window.postMessage({
                type: 'ANDROID_BRIDGE_CALL',
                method: 'saveComboSchedule',
                args: [JSON.stringify(mergedCombo), promiseId],
                messageId: promiseId
            }, window.location.origin);
        });
    }
};

// 旧接口兼容（直接引用 shiguang 实现）

// AndroidBridge 兼容旧接口，直接引用 shiguangBridge
window.AndroidBridge = window.shiguangBridge;

// AndroidBridgePromise 兼容旧接口，直接引用 shiguangBridgePromise
window.AndroidBridgePromise = window.shiguangBridgePromise;

// 监听来自 content-script 的消息
window.addEventListener('message', (event) => {
    // 确保消息来自我们自己的域并且是我们的类型
    if (event.source === window && event.data && event.data.type) {
        // Promise 响应处理
        if (event.data.type === 'ANDROID_BRIDGE_PROMISE_RESPONSE') {
            const { messageId, value, isError } = event.data;
            const promiseCallbacks = pendingPromises.get(messageId);
            if (promiseCallbacks) {
                if (isError) {
                    console.error('JS: _rejectAndroidPromise via postMessage', messageId, 'Error:', value);
                    promiseCallbacks.reject(new Error(value));
                } else {
                    console.log('JS: _resolveAndroidPromise via postMessage', messageId, 'Result:', value);
                    promiseCallbacks.resolve(value);
                }
                pendingPromises.delete(messageId);
            } else {
                console.warn('JS: ANDROID_BRIDGE_PROMISE_RESPONSE - Promise ID not found or already resolved/rejected:', messageId);
            }
        }
        // 验证请求处理
        else if (event.data.type === 'VALIDATE_PROMPT_INPUT') {
            const { validatorFnName, inputValue, requestId } = event.data;
            let validationError = false;

            if (typeof window[validatorFnName] === 'function') {
                validationError = window[validatorFnName](inputValue);
            } else {
                console.warn(`Validator function '${validatorFnName}' not found or is not a function in page context. Will report an error to content-script.`);
                validationError = '内部错误：验证函数未找到或无法执行。';
            }

            window.postMessage({
                type: 'VALIDATION_RESULT',
                requestId: requestId,
                validationError: validationError
            }, window.location.origin);
        }
    }
});