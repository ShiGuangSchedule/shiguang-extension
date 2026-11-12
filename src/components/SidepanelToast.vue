<!-- src/components/SidepanelToast.vue -->
<script setup lang="ts">
import { useSidepanelToast } from '@/composables/useSidepanelToast';

const state = useSidepanelToast();
</script>

<template>
  <Teleport to="body">
    <Transition name="sidepanel-toast-fade">
      <div
        v-if="state.visible && state.current"
        class="sidepanel-toast"
        role="status"
        aria-live="polite"
      >
        {{ state.current.message }}
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sidepanel-toast {
  position: fixed;
  bottom: calc(72px + env(safe-area-inset-bottom, 0px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 999999;

  max-width: calc(100% - 32px);
  padding: 10px 18px;

  background-color: var(
    --color-inverse-surface,
    var(--color-on-surface, var(--color-text))
  );

  color: var(
    --color-inverse-on-surface,
    var(--color-surface, var(--color-body))
  );

  border-radius: 8px;

  font-size: 13px;
  line-height: 1.4;
  text-align: center;
  word-break: break-word;

  pointer-events: none;
  user-select: none;
}

.sidepanel-toast-fade-enter-active,
.sidepanel-toast-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.sidepanel-toast-fade-enter-from,
.sidepanel-toast-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
.sidepanel-toast-fade-enter-to,
.sidepanel-toast-fade-leave-from {
  opacity: 1;
  transform: translate(-50%, 0);
}
</style>