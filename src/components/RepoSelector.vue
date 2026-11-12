<!-- src/components/RepoSelector.vue -->
<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { LocalSchoolEntry, AdapterCategory, LocalAdapterView } from '@/modules/repo/types';
import { executionCache } from '@/modules/execution/cache';
import { showSidepanelToast } from '@/composables/useSidepanelToast';

const {
  isSupported,
  repoHandle,
  adapterList,
  sortedSchools,
  isLoading,
  errorMessage,
  hasSavedHandle,
  restoreSavedRepo,
  selectAndInitRepo,
  refreshRepo,
  getAdapterSource,
} = useRepo();

const searchQuery = ref('');
const selectedCategory = ref<AdapterCategory>('BACHELOR_AND_ASSOCIATE');
const currentSchool = ref<LocalSchoolEntry | null>(null);
const usingAdapterId = ref<string | null>(null);

const categories: { key: AdapterCategory; label: string }[] = [
  { key: 'BACHELOR_AND_ASSOCIATE', label: '本/专科生' },
  { key: 'POSTGRADUATE', label: '研究生' },
  { key: 'GENERAL_TOOL', label: '通用工具' },
];

// 获取当前分类的显示名称
const currentCategoryLabel = computed(() => {
  const cat = categories.find(c => c.key === selectedCategory.value);
  return cat ? cat.label : '';
});

const filteredSchools = computed(() => {
  if (!Array.isArray(adapterList.value)) return [];

  let list = (sortedSchools.value ?? []).filter(school => {
    return adapterList.value.some(
      item => item.school.id === school.id && item.adapter.category === selectedCategory.value
    );
  });

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase();
    list = list.filter(
      school => school.name.toLowerCase().includes(q) || school.initial.toLowerCase().includes(q)
    );
  }

  return list;
});

watch(filteredSchools, (newList) => {
  if (currentSchool.value && !newList.some(s => s.id === currentSchool.value!.id)) {
    currentSchool.value = null;
  }
});

const alphabetList = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// 将列表按字母分组，用于渲染锚点
const schoolsMap = computed(() => {
  const map: Record<string, LocalSchoolEntry[]> = {};
  for (const school of filteredSchools.value) {
    const initial = (school.initial || school.name.charAt(0)).toUpperCase();
    if (!map[initial]) {
      map[initial] = [];
    }
    map[initial].push(school);
  }
  return map;
});

const currentSchoolAdapters = computed(() => {
  if (!currentSchool.value) return [];
  return adapterList.value.filter(
    item => item.school.id === currentSchool.value!.id && item.adapter.category === selectedCategory.value
  );
});

function handleSelectSchool(school: LocalSchoolEntry) {
  currentSchool.value = school;
}

function handleBackToList() {
  currentSchool.value = null;
}

async function handleUseAdapter(view: LocalAdapterView) {
  if (usingAdapterId.value) return;
  
  usingAdapterId.value = view.adapter.adapter_id;
  try {
    // 从本地文件读取代码
    const code = await getAdapterSource(view);
    
    // 覆盖写入缓存，供首页卡片执行
    await executionCache.replaceAll([{
      name: `${view.school.name} - ${view.adapter.adapter_name}`,
      code,
      importUrl: view.adapter.import_url
    }]);
    
    showSidepanelToast('已载入到待执行缓存');
  } catch (e: any) {
    showSidepanelToast('获取代码失败: ' + e.message);
  } finally {
    usingAdapterId.value = null;
  }
}
</script>

<template>
  <div class="repo-container">
    <var-cell v-if="!isSupported" type="danger" title="环境不支持" description="当前浏览器不支持 File System Access API，请使用 Chromium 内核浏览器。" />

    <template v-else>
      <div v-if="!repoHandle" class="empty-state">
        <p class="empty-desc">请选择本地的“适配器仓库”根目录以开始使用。</p>
        <var-space direction="column" size="normal" align="center">
          <var-button v-if="hasSavedHandle" type="primary" block :loading="isLoading" @click="restoreSavedRepo">
            使用上次选择的仓库
          </var-button>
          <var-button :type="hasSavedHandle ? 'default' : 'primary'" block :loading="isLoading" @click="selectAndInitRepo">
            选择本地仓库文件夹
          </var-button>
        </var-space>
      </div>

      <div v-else class="main-layout">
        <div class="split-pane-layout" :class="{ 'has-selection': currentSchool }">
          
          <!-- 左侧一级面板 -->
          <div class="pane-left">
            <var-tabs
              elevation
              color="var(--color-surface)"
              active-color="var(--color-primary)"
              inactive-color="var(--color-text-disabled)"
              v-model:active="selectedCategory"
            >
              <var-tab v-for="cat in categories" :key="cat.key" :name="cat.key">
                {{ cat.label }}
              </var-tab>
            </var-tabs>

            <!-- 搜索栏 -->
            <div class="search-toolbar">
              <!-- 手动刷新按钮 -->
              <var-button
                text
                type="primary"
                size="small"
                :loading="isLoading"
                @click="refreshRepo"
                title="刷新数据"
                class="toolbar-btn"
              >
                <var-icon name="refresh" size="20" />
              </var-button>

              <!-- 搜索框 -->
              <div style="flex: 1; min-width: 0;">
                <var-input
                  v-model="searchQuery"
                  placeholder="搜索学校名称..."
                  clearable
                  size="small"
                  variant="outlined"
                >
                  <template #prepend-icon>
                    <var-icon name="magnify" size="18" color="var(--color-text-disabled)" />
                  </template>
                </var-input>
              </div>

              <!-- 切换目录按钮 -->
              <var-button 
                text 
                type="primary" 
                size="small" 
                @click="selectAndInitRepo"
                class="toolbar-btn"
              >
                切换目录
              </var-button>
            </div>

            <!-- 内部滚动视窗 -->
            <div class="scroll-area">
              <div v-if="filteredSchools.length === 0" class="no-data-text">
                没有找到匹配的学校或适配器
              </div>

              <div v-else class="school-list-wrapper">
                <template v-for="letter in alphabetList" :key="letter">
                  <template v-if="schoolsMap[letter] && schoolsMap[letter].length > 0">
                    <div class="anchor-header">{{ letter }}</div>

                    <div class="card-list">
                      <div
                        v-for="school in schoolsMap[letter]"
                        :key="school.id"
                        class="card-item school-card"
                        :class="{ 'active-school': currentSchool?.id === school.id }"
                        @click="handleSelectSchool(school)"
                      >
                        <div class="flex-center" style="gap: 10px; min-width: 0;">
                          <var-icon name="school" size="20" color="var(--color-primary)" style="flex-shrink: 0;" />
                          <span class="card-title">{{ school.name }}</span>
                        </div>
                        <div class="flex-center" style="gap: 8px; flex-shrink: 0;">
                          <span class="badge">
                            {{ adapterList.filter(i => i.school.id === school.id && i.adapter.category === selectedCategory).length }} 个
                          </span>
                          <var-icon name="chevron-right" size="18" color="var(--color-text-disabled)" class="arrow-icon" />
                        </div>
                      </div>
                    </div>
                  </template>
                </template>
              </div>
            </div>
          </div>

          <!-- 右侧二级面板 -->
          <div class="pane-right">
            <div class="sub-topbar mobile-back-bar">
              <var-button text size="small" @click="handleBackToList">
                <var-icon name="chevron-left" size="20" /> 返回列表
              </var-button>
              <span class="sub-title">{{ currentSchool?.name }}</span>
            </div>

            <div class="desktop-detail-header" v-if="currentSchool">
              <span class="sub-title">{{ currentSchool.name }} {{ currentCategoryLabel }}</span>
              <span class="version-tag">共 {{ currentSchoolAdapters.length }} 项</span>
            </div>

            <!-- 内部滚动视窗 -->
            <div class="scroll-area">
              <div v-if="!currentSchool" class="placeholder-tip center-content">
                <var-icon name="information-outline" size="48" color="var(--color-text-disabled)" />
                <p>请从左侧选择一所院校查看适配器详情</p>
              </div>

              <div v-else class="card-list">
                <div v-if="currentSchoolAdapters.length === 0" class="no-data-text">
                  该分类下暂无适配器
                </div>
                <div
                  v-for="item in currentSchoolAdapters"
                  :key="item.adapter.adapter_id"
                  class="card-item adapter-card"
                >
                  <div class="flex-between">
                    <span class="card-title">{{ item.adapter.adapter_name }}</span>
                    <span class="version-tag">ID: {{ item.adapter.adapter_id }}</span>
                  </div>
                  <p class="adapter-desc">{{ item.adapter.description || '暂无详细描述' }}</p>
                  <div class="adapter-footer">
                    <div class="flex-center" style="gap: 4px">
                      <var-icon name="information-outline" size="14" color="var(--color-text-disabled)" />
                      <span>维护者: {{ item.adapter.maintainer || '未知' }}</span>
                    </div>
                    <span class="path-text" :title="item.adapter.asset_js_path">
                      {{ item.adapter.asset_js_path }}
                    </span>
                  </div>

                  <!-- 载入按钮 -->
                  <div class="adapter-actions">
                    <var-button 
                      type="primary" 
                      size="small" 
                      block
                      :loading="usingAdapterId === item.adapter.adapter_id"
                      @click="handleUseAdapter(item)"
                    >
                      载入到待执行缓存
                    </var-button>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <var-cell v-if="errorMessage" type="danger" :description="errorMessage" />
    </template>
  </div>
</template>

<style scoped>

.repo-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  background-color: var(--color-body);
  overflow: hidden;
}

.repo-container .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  gap: 16px;
  flex: 1;
}

.repo-container .empty-desc {
  font-size: 12px;
  color: var(--color-text-description);
  margin: 0;
  text-align: center;
}

.repo-container .main-layout {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.repo-container .split-pane-layout {
  display: flex;
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.repo-container .pane-left,
.repo-container .pane-right {
  display: flex;
  flex-direction: column;
  position: relative;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background-color: var(--color-body);
  box-sizing: border-box;
}

.repo-container .pane-right {
  border-left: 1px solid var(--color-outline-variant);
  background-color: var(--color-surface-container-lowest, var(--color-body));
}

.repo-container .search-toolbar,
.repo-container .sub-topbar,
.repo-container .desktop-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-outline-variant);
  gap: 6px;
  flex-shrink: 0;
}

.repo-container .toolbar-btn {
  padding: 0 4px;
  min-width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.repo-container .desktop-detail-header { display: none; }
.repo-container .mobile-back-bar { display: flex; }

.repo-container .scroll-area {
  position: absolute;
  top: 0; 
  bottom: 0; 
  left: 0; 
  right: 0;
  overflow-y: auto;
  overflow-x: hidden; 
  padding: 4px 12px 0 12px;
  box-sizing: border-box;
}

.repo-container .pane-left .scroll-area { top: 92px; } 
.repo-container .pane-right .scroll-area { top: 45px; }

.repo-container .card-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 0;
  width: 100%;
  box-sizing: border-box;
}

.repo-container .flex-center { display: flex; align-items: center; }
.repo-container .flex-between { display: flex; align-items: center; justify-content: space-between; }

.repo-container .anchor-header {
  height: 28px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  color: var(--color-primary);
  font-weight: bold;
  font-size: 13px;
  margin: 12px 0 4px;
  border-bottom: 1px solid var(--color-outline-variant);
}

.repo-container .card-item {
  background: var(--color-surface);
  border: 1px solid var(--color-outline-variant);
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,.02);
  transition: all 0.2s;
}

.repo-container .school-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  cursor: pointer;
}
.repo-container .school-card:hover {
  border-color: var(--color-primary);
  background: var(--color-surface-container);
}
.repo-container .school-card.active-school {
  border-color: var(--color-primary);
  background-color: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface));
}

.repo-container .card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.repo-container .badge {
  font-size: 10px; padding: 2px 8px;
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-primary); border-radius: 10px; font-weight: 500;
}
.repo-container .sub-title { font-size: 14px; font-weight: bold; color: var(--color-text); }
.repo-container .adapter-card { display: flex; flex-direction: column; padding: 14px 16px; gap: 8px; }
.repo-container .version-tag {
  font-size: 10px; padding: 2px 6px; background: var(--color-body);
  color: var(--color-text-description); border-radius: 4px; font-family: monospace;
}
.repo-container .adapter-desc { font-size: 12px; color: var(--color-text-description); margin: 0; line-height: 1.4; }
.repo-container .adapter-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding-top: 8px; border-top: 1px dashed var(--color-outline-variant);
  font-size: 11px; color: var(--color-text-disabled);
}
.repo-container .adapter-footer .path-text {
  font-family: monospace; max-width: 140px; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
}

.repo-container .adapter-actions {
  margin-top: 4px;
}

.repo-container .no-data-text {
  text-align: center;
  color: var(--color-text-disabled);
  font-size: 13px;
  margin-top: 60px;
}

.repo-container .placeholder-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
  color: var(--color-text-disabled);
  font-size: 13px;
}

.repo-container .placeholder-tip.center-content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  margin: 0;
  width: 80%;
}

@media (min-width: 680px) {
  .repo-container .mobile-back-bar { display: none !important; }
  .repo-container .desktop-detail-header { display: flex !important; }
  
  .repo-container .pane-left {
    flex: 0 0 320px !important; 
    width: 320px !important;
    max-width: 320px !important;
    border-right: 1px solid var(--color-outline-variant);
  }
  .repo-container .pane-right { 
    flex: 1 1 0 !important; 
    min-width: 0;
  }
  
  .repo-container .pane-right .scroll-area { top: 45px; }
  .repo-container .school-card .arrow-icon { display: none; }
}

@media (max-width: 679px) {
  .repo-container .split-pane-layout:not(.has-selection) .pane-right { display: none; }
  .repo-container .split-pane-layout.has-selection .pane-left { display: none; }
}
</style>