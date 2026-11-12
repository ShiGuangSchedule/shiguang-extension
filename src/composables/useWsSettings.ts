// src/composables/useWsSettings.ts
import { reactive, computed, onMounted } from 'vue';
import { wsPortItem, wsApiKeyItem } from '@/modules/storage';
import { connect, connectWith, disconnect, wsState } from '@/modules/ws';

const DEFAULT_PORT = 59508;

const state = reactive({
  savedPort: DEFAULT_PORT,
  savedApiKey: '',
  draftPort: DEFAULT_PORT,
  draftApiKey: '',
  isLoading: true,
  isApplying: false,
});

const isDirty = computed(() => {
  return state.draftPort !== state.savedPort || state.draftApiKey !== state.savedApiKey;
});

async function load() {
  state.isLoading = true;
  try {
    const port = await wsPortItem.getValue();
    const apiKey = await wsApiKeyItem.getValue();
    
    state.savedPort = port;
    state.savedApiKey = apiKey;
    state.draftPort = port;
    state.draftApiKey = apiKey;
  } finally {
    state.isLoading = false;
  }
}

function validatePort() {
  if (!Number.isInteger(state.draftPort) || state.draftPort < 1 || state.draftPort > 65535) {
    throw new Error('端口必须是 1-65535 之间的整数');
  }
  return state.draftPort;
}

async function testConnection(): Promise<{ connected: boolean }> {
  const port = validatePort();
  state.isApplying = true;
  try {
    disconnect();
    await connectWith(port, state.draftApiKey);
    return { connected: true };
  } catch (e) {
    console.error(e);
    return { connected: false };
  } finally {
    state.isApplying = false;
  }
}

async function apply(): Promise<{ connected: boolean }> {
  const port = validatePort();
  state.isApplying = true;
  try {
    await wsPortItem.setValue(port);
    await wsApiKeyItem.setValue(state.draftApiKey);
    
    state.savedPort = port;
    state.savedApiKey = state.draftApiKey;

    disconnect();
    await connect();
    return { connected: true };
  } catch (e) {
    console.error(e);
    return { connected: false };
  } finally {
    state.isApplying = false;
  }
}

function discard() {
  state.draftPort = state.savedPort;
  state.draftApiKey = state.savedApiKey;
}

export function useWsSettings() {
  onMounted(() => {
    if (state.isLoading) load();
  });

  return { state, wsState, isDirty, apply, discard, testConnection };
}