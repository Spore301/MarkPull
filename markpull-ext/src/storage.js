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
