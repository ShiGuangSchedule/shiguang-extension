<!-- src/components/ExecutionCacheCard.vue -->
<script setup lang="ts">
import { useExecutionCache } from '@/composables/useExecutionCache';

const { 
  currentUnit, 
  isExecuting, 
  hasUserScriptPermission,
  openImportUrl, 
  goToPermissionSettings,
  executeAdapter 
} = useExecutionCache();
</script>

<template>
  <div class="cache-section">
    <div class="section-title">执行适配器</div>

    <!-- 核心卡片区域 -->
    <div class="cache-card">
      <div class="cache-info">
        <div class="cache-name">
          {{ currentUnit ? currentUnit.name : '暂无推送的适配代码' }}
        </div>
        
        <!-- 如果存在跳转链接才显示 -->
        <var-button
          v-if="currentUnit?.importUrl"
          text
          type="primary"
          size="small"
          class="jump-btn"
          @click="openImportUrl"
        >
          前往教务系统
          <var-icon name="chevron-right" size="16" style="margin-left: 2px;" />
        </var-button>
      </div>

      <!-- 唯一的核心操作按钮：没代码或没权限时置灰 -->
      <var-button
        type="primary"
        block
        :disabled="!currentUnit || !hasUserScriptPermission"
        :loading="isExecuting"
        @click="executeAdapter"
      >
        开始导入
      </var-button>
    </div>

    <!-- 卡片下方的折叠提示层：无权限时展开 -->
    <var-collapse-transition :expand="!hasUserScriptPermission">
      <div class="permission-alert">
        <div class="alert-content">
          <var-icon name="alert-circle-outline" color="var(--color-warning)" size="20" />
          <div class="permission-text">
            为了安全执行导入，需要您在浏览器扩展管理页开启「允许用户脚本」权限。
          </div>
        </div>
        <var-button
          type="warning"
          size="small"
          class="auth-btn"
          @click="goToPermissionSettings"
        >
          去开启权限
        </var-button>
      </div>
    </var-collapse-transition>
  </div>
</template>

<style scoped>
.cache-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.cache-card {
  background-color: var(--color-surface-container);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cache-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 24px;
}

.cache-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  word-break: break-all;
}

.jump-btn {
  flex-shrink: 0;
  padding: 0;
}

/* 权限警告样式（折叠层内部） */
.permission-alert {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background-color: var(--color-warning-container);
  color: var(--color-on-warning-container);
  border-radius: 12px;
  margin-top: 4px;
}

.alert-content {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
  line-height: 1.5;
}

.alert-content var-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.permission-text {
  flex: 1;
}

.auth-btn {
  align-self: flex-end;
}
</style>