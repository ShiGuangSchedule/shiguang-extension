// src/modules/repo/types.ts

/** 根目录索引结构 (index/root_index.yaml) */
export interface LocalRootIndex {
  schools: LocalSchoolEntry[];
}

/** 单个学校条目 */
export interface LocalSchoolEntry {
  id: string;
  name: string;
  initial: string;
  resource_folder: string;
}

/** 适配器列表文件结构 (resources/{schoolId}/adapters.yaml) */
export interface LocalAdaptersFile {
  adapters: LocalAdapterEntry[];
}

/** 适配器分类 */
export type AdapterCategory =
  | 'BACHELOR_AND_ASSOCIATE'
  | 'POSTGRADUATE'
  | 'GENERAL_TOOL';

/** 单个适配器条目 */
export interface LocalAdapterEntry {
  adapter_id: string;
  adapter_name: string;
  category: AdapterCategory;
  asset_js_path: string;
  import_url?: string;
  maintainer: string;
  description: string;
}

/** 本地模式的视图模型（适配器 + 所属学校） */
export interface LocalAdapterView {
  adapter: LocalAdapterEntry;
  school: LocalSchoolEntry;
}