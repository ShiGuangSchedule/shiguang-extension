// src/modules/adapter-export/exporters/file.ts

/** 默认文件名：shiguangschedule_<毫秒时间戳>.json */
export function buildDefaultFilename(): string {
  const timestamp = Date.now();
  return `shiguangschedule_${timestamp}.json`;
}

/**
 * 将 JS 对象下载为 JSON 文件。
 * 使用原生 <a> 标签触发下载
 * @param data      任意可序列化对象
 * @param filename  目标文件名，省略时使用 buildDefaultFilename()
 * @returns         实际使用的文件名
 */
export async function downloadJsonFile(
  data: unknown,
  filename?: string,
): Promise<string> {
  const finalName = filename ?? buildDefaultFilename();
  const text = JSON.stringify(data, null, 2);

  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  try {
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = finalName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    // 延迟释放内存
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return finalName;
}