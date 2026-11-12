<!-- src/entrypoints/sidepanel/App.vue -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import BridgeUI from '@/components/BridgeUI.vue';
import SidepanelToast from '@/components/SidepanelToast.vue';
import WsConnectionCard from '@/components/WsConnectionCard.vue';
import ExecutionCacheCard from '@/components/ExecutionCacheCard.vue';
import { connect, disconnect } from '@/modules/ws';
import { exportStrategyItem, type ExportStrategy } from '@/modules/storage';

const activeView = ref('home');
const strategy = ref<ExportStrategy>('file');

onMounted(async () => {
  strategy.value = await exportStrategyItem.getValue();

  try {
    await connect();
  } catch (e: any) {
    console.warn('[SidePanel] WS 连接失败:', e.message);
  }
});

onUnmounted(() => {
  disconnect();
});

async function selectStrategy(val: ExportStrategy) {
  strategy.value = val;
  await exportStrategyItem.setValue(val);
}
</script>

<template>
  <div class="sidepanel-container">
    <BridgeUI />
    <SidepanelToast />

    <header class="sidepanel-header">
      <h2>拾光扩展</h2>
    </header>

    <main class="sidepanel-content">
      <div v-if="activeView === 'home'" class="view-pane">
        <p class="placeholder-text">这里是扩展的默认主页面，可以放置快捷导入、状态显示等核心功能。</p>

        <!-- 导出策略选择器 -->
        <div class="strategy-section">
          <div class="section-title">导出策略</div>
          
          <!-- 移除了 mode="outline"，让被选中项成为实心深色背景 -->
          <var-button-group type="default" style="width: 100%;">
            <var-button
              :type="strategy === 'file' ? 'primary' : 'default'"
              style="flex: 1;"
              @click="selectStrategy('file')"
            >
              导出本地文件
            </var-button>
            <var-button
              :type="strategy === 'app' ? 'primary' : 'default'"
              style="flex: 1;"
              @click="selectStrategy('app')"
            >
              推送至应用
            </var-button>
          </var-button-group>
        </div>

        <!-- 连接配置卡片 -->
        <div style="margin-top: 16px;">
          <WsConnectionCard />
        </div>

        <!-- 执行适配器卡片 -->
        <div style="margin-top: 16px;">
          <ExecutionCacheCard />
        </div>
      </div>

      <div v-else-if="activeView === 'repo'" class="view-pane-full">
        <RepoSelector />
      </div>
    </main>

    <var-bottom-navigation v-model:active="activeView" class="sidepanel-nav">
      <var-bottom-navigation-item name="home" label="主页" icon="home" />
      <var-bottom-navigation-item name="repo" label="仓库管理" icon="format-list-checkbox" />
    </var-bottom-navigation>
  </div>
</template>

<style scoped>
.sidepanel-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--color-body);
  box-sizing: border-box;
  overflow: hidden;
}

.sidepanel-header {
  padding: 12px 16px;
  background-color: var(--color-surface);
  border-bottom: 1px solid var(--color-outline-variant);
  flex-shrink: 0;
}

.sidepanel-header h2 {
  font-size: 15px;
  font-weight: bold;
  margin: 0;
  color: var(--color-text);
}

.sidepanel-content {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
}

.view-pane {
  padding: 12px;
  overflow-y: auto;
  flex: 1;
}

.view-pane-full {
  position: relative;
  flex: 1;
  min-height: 0;
}

.placeholder-text {
  color: var(--color-text-description);
  font-size: 13px;
  margin: 0;
}

.strategy-section {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}
</style>