<!-- src/components/WsConnectionCard.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useWsSettings } from '@/composables/useWsSettings';
import { showSidepanelToast } from '@/composables/useSidepanelToast';

const { state, wsState, isDirty, apply, discard, testConnection } = useWsSettings();

// 控制密码显隐
const showPassword = ref(false);

// 端口校验
const portError = computed(() => {
  if (state.isLoading) return undefined;
  if (!Number.isInteger(state.draftPort) || state.draftPort < 1 || state.draftPort > 65535) {
    return '端口必须是 1-65535 之间的整数';
  }
  return undefined;
});

async function handleTest() {
  if (portError.value) return showSidepanelToast(portError.value);
  const { connected } = await testConnection();
  showSidepanelToast(connected ? '连接成功' : '连接失败，请检查端口和 Key');
}

async function handleSave() {
  if (portError.value) return showSidepanelToast(portError.value);
  const { connected } = await apply();
  showSidepanelToast(connected ? '已保存并连接成功' : '已保存，但连接失败');
}
</script>

<template>
  <div class="ws-section">
    <div class="section-title">连接</div>

    <div class="ws-card">
      <div class="ws-body">
        <!-- API 端口 -->
        <div class="input-group">
          <label>API 端口</label>
          <var-counter 
            v-model="state.draftPort"
            :min="1"
            :max="65535"
            :step="1"
            :disabled="state.isLoading || state.isApplying"
            input-width="70px"
            input-text-size="15px"
            button-size="36px"
          />
        </div>

        <!-- API 密钥 -->
        <div class="input-group">
          <label>API 密钥</label>
          <var-input
            v-model="state.draftApiKey"
            variant="outlined"
            placeholder="请输入密钥"
            :type="showPassword ? 'text' : 'password'"
            :disabled="state.isLoading || state.isApplying"
          >
            <template #append-icon>
              <var-icon 
                name="view" 
                style="cursor: pointer;" 
                :color="showPassword ? 'var(--color-primary)' : 'var(--color-text-disabled)'"
                @click="showPassword = !showPassword" 
              />
            </template>
          </var-input>
        </div>
      </div>

      <!-- 操作栏 -->
      <div class="ws-footer">
        <var-button 
          type="primary" 
          :loading="state.isApplying"
          @click="handleTest"
        >
          测试连接
        </var-button>

        <div class="status-area" v-if="wsState.isConnected">
          <var-icon name="check-circle" color="var(--color-primary)" size="18" />
          <span class="status-text">
            已连接 · {{ wsState.platform || '未知平台' }}
          </span>
          <span class="version-badge" v-if="wsState.appVersion">
            v{{ wsState.appVersion }}
          </span>
        </div>
        <div class="status-area" v-else>
          <span class="status-text" style="color: var(--color-text-disabled)">未连接</span>
        </div>
      </div>
    </div>

    <!-- 未保存提示栏 -->
    <div v-if="isDirty" class="dirty-actions-bar">
      <div class="dirty-hint">
        <span class="dot"></span>
        <span>有未保存的更改</span>
      </div>
      <div class="actions">
        <var-button 
          type="primary" 
          :loading="state.isApplying"
          @click="handleSave"
        >
          <template #icon><var-icon name="content-save-outline" /></template>
          保存
        </var-button>
        <var-button type="danger" @click="discard">
          <template #icon><var-icon name="undo-variant" /></template>
          放弃
        </var-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ws-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.ws-card {
  background-color: var(--color-surface-container);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ws-body {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 16px;
  align-items: end;
}

@media (max-width: 400px) {
  .ws-body {
    grid-template-columns: 1fr;
  }
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-group label {
  font-size: 13px;
  color: var(--color-text-description);
}

.ws-footer {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-area {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-text {
  font-size: 13px;
  color: var(--color-primary);
}

.version-badge {
  font-size: 11px;
  padding: 2px 6px;
  background: var(--color-surface-container-high);
  border: 1px solid var(--color-outline-variant);
  border-radius: 12px;
  color: var(--color-text);
}

.dirty-actions-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid var(--color-outline-variant);
  margin-top: 4px;
}

.dirty-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--color-text-description);
}

.dirty-hint .dot {
  width: 6px;
  height: 6px;
  background-color: var(--color-error);
  border-radius: 50%;
}

.actions {
  display: flex;
  gap: 8px;
}
</style>