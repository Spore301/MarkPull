export async function getStorageData(key) {
  const result = await chrome.storage.local.get(key);
  return result[key];
}

export async function setStorageData(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

export async function getQueue() {
  const queue = await getStorageData('save_queue');
  return queue || [];
}

export async function addToQueue(item) {
  const queue = await getQueue();
  queue.push(item);
  await setStorageData('save_queue', queue);
}

export async function clearQueue() {
  await setStorageData('save_queue', []);
}

const DEFAULT_AI_CONFIG = {
  activeVendor: 'openai',
  vendors: {
    openai: { apiKey: '', model: 'gpt-4o' },
    deepseek: { apiKey: '', model: 'deepseek-chat' },
    anthropic: { apiKey: '', model: 'claude-3-5-sonnet-20240620' },
    ollama: { apiKey: 'http://localhost:11434', model: 'kimi-k2.5:cloud' },
    openrouter: { apiKey: '', model: 'qwen/qwen3.5-9b' }
  }
};

export async function getAiConfig() {
  const config = await getStorageData('ai_config');
  return config || DEFAULT_AI_CONFIG;
}

export async function setAiConfig(config) {
  await setStorageData('ai_config', config);
}
