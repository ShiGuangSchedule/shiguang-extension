export interface CachedCodeUnit {
  name: string;       // 代码名称（调试/展示用）
  code: string;       // 实际执行的源码
  importUrl?: string; // 可选的外部依赖或资源链接
}