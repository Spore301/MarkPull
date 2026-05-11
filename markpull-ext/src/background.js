import { getQueue, clearQueue, getAiConfig } from './storage.js';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

chrome.runtime.onInstalled.addListener(async () => {
  const manifest = chrome.runtime.getManifest();
  if (manifest.content_scripts) {
    for (const cs of manifest.content_scripts) {
      for (const tab of await chrome.tabs.query({ url: cs.matches })) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: cs.js,
          });
        } catch (err) {
          console.warn('Could not inject content script into tab', tab.id, err);
        }
      }
    }
  }
});

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3';

// 1. Auth Flow
async function getAuthToken(interactive = true) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(token);
      }
    });
  });
}

// 2. Drive Folders
async function getOrCreateFolder(token, folderName, parentId = null) {
  const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false` + (parentId ? ` and '${parentId}' in parents` : ` and 'root' in parents`);
  
  const searchRes = await fetch(`${DRIVE_API_URL}/files?q=${encodeURIComponent(query)}&spaces=drive&fields=files(id, name)`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const searchData = await searchRes.json();
  
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }
  
  // Create folder
  const metadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder'
  };
  if (parentId) metadata.parents = [parentId];
  
  const createRes = await fetch(`${DRIVE_API_URL}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(metadata)
  });
  
  const createData = await createRes.json();
  return createData.id;
}

// 3. Drive Upload
async function saveToGoogleDrive(token, projectName, filename, content) {
  // Get/Create MarkPull root
  const rootId = await getOrCreateFolder(token, 'MarkPull');
  // Get/Create Project folder
  const projectId = await getOrCreateFolder(token, projectName, rootId);
  
  // Create file inside Project folder
  const metadata = {
    name: filename,
    mimeType: 'text/markdown',
    parents: [projectId]
  };
  
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: 'text/markdown' }));

  const res = await fetch(`${DRIVE_UPLOAD_URL}/files?uploadType=multipart`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

// 4. List Files for Library
async function getLibraryFiles(token, forceRefresh = false) {
  if (!forceRefresh) {
    const cached = await chrome.storage.session.get('library_cache');
    if (cached.library_cache) {
      return cached.library_cache;
    }
  }

  const rootId = await getOrCreateFolder(token, 'MarkPull');
  const query = `'${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  
  const foldersRes = await fetch(`${DRIVE_API_URL}/files?q=${encodeURIComponent(query)}&fields=files(id, name, webViewLink, createdTime)`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const foldersData = await foldersRes.json();
  if (!foldersData.files) return { projects: [], files: [] };
  
  const projects = foldersData.files;
  let allFiles = [];
  
  for (const proj of projects) {
    const q = `'${proj.id}' in parents and trashed=false`;
    const filesRes = await fetch(`${DRIVE_API_URL}/files?q=${encodeURIComponent(q)}&fields=files(id, name, createdTime, webViewLink, webContentLink)`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const filesData = await filesRes.json();
    if (filesData.files) {
      const projFiles = filesData.files.map(f => ({ ...f, project: proj.name, projectId: proj.id }));
      allFiles = allFiles.concat(projFiles);
    }
  }
  
  const result = { projects: projects.map(p => ({ id: p.id, name: p.name, webViewLink: p.webViewLink, createdTime: p.createdTime })), files: allFiles };
  await chrome.storage.session.set({ library_cache: result });
  return result;
}

// 4b. Get Drive Quota
async function getDriveQuota(token) {
  const res = await fetch(`${DRIVE_API_URL}/about?fields=storageQuota`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to fetch quota');
  return res.json();
}

// 5. Download File Content from Drive
async function downloadFileContent(token, fileId) {
  const res = await fetch(`${DRIVE_API_URL}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Download failed');
  return res.text();
}

// 6. Delete File from Drive (Move to Trash)
async function deleteDriveFile(token, fileId) {
  const res = await fetch(`${DRIVE_API_URL}/files/${fileId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ trashed: true })
  });
  if (!res.ok) throw new Error('Delete failed');
  return res.json();
}

async function renameDriveFile(token, fileId, newName) {
  const res = await fetch(`${DRIVE_API_URL}/files/${fileId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: newName })
  });
  if (!res.ok) throw new Error('Rename failed');
  return res.json();
}

// 7. AI Integration
async function queryAI(token, prompt, contextText) {
  const config = await getAiConfig();
  const vendor = config.activeVendor;
  const vendorConfig = config.vendors[vendor];
  
  if (!vendorConfig.apiKey && vendor !== 'ollama') {
    throw new Error(`Please configure your ${vendor} API Key in the Settings tab.`);
  }

  const model = vendorConfig.model.trim();
  const apiKey = vendorConfig.apiKey.trim();

  if (vendor === 'ollama') {
    const host = apiKey || 'http://localhost:11434';
    const payload = {
      model: model || "llama3",
      prompt: `Context Document: \n${contextText}\n\nUser Question: ${prompt}`,
      stream: false
    };
    const response = await fetch(`${host.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('Failed to connect to Ollama. Make sure it is running.');
    const data = await response.json();
    return data.response;
  }

  if (vendor === 'anthropic') {
    const url = "https://api.anthropic.com/v1/messages";
    const payload = {
      model: model || "claude-3-5-sonnet-20240620",
      max_tokens: 2048,
      system: `Context Document: \n${contextText}\n\n`,
      messages: [
        { role: "user", content: prompt }
      ]
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Anthropic API Error');
    }
    const data = await response.json();
    return data.content[0].text;
  }

  // OpenAI, DeepSeek, OpenRouter all use similar OpenAI format
  let url = "https://api.openai.com/v1/chat/completions";
  let headers = { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  if (vendor === 'deepseek') {
    url = "https://api.deepseek.com/chat/completions";
  } else if (vendor === 'openrouter') {
    url = "https://openrouter.ai/api/v1/chat/completions";
    headers['HTTP-Referer'] = 'https://markpull.app';
    headers['X-Title'] = 'MarkPull Extension';
  }

  const payload = {
    model: model || (vendor === 'openai' ? 'gpt-4o' : vendor === 'deepseek' ? 'deepseek-chat' : 'qwen/qwen3.5-9b'),
    messages: [
      { role: "system", content: `Context Document: \n${contextText}\n\n` },
      { role: "user", content: prompt }
    ]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || `${vendor} API Error`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'save_to_drive') {
    getAuthToken(true)
      .then(token => saveToGoogleDrive(token, request.projectName, request.filename, request.content))
      .then(result => sendResponse({ status: 'ok', result }))
      .catch(error => sendResponse({ status: 'error', message: error.message }));
    return true; // async
  }
  
  if (request.action === 'get_library') {
    getAuthToken(request.interactive !== false)
      .then(token => getLibraryFiles(token, request.forceRefresh))
      .then(result => sendResponse({ status: 'ok', data: result }))
      .catch(error => sendResponse({ status: 'error', message: error.message }));
    return true; // async
  }

  if (request.action === 'download_file') {
    getAuthToken(true)
      .then(token => downloadFileContent(token, request.fileId))
      .then(result => sendResponse({ status: 'ok', content: result }))
      .catch(error => sendResponse({ status: 'error', message: error.message }));
    return true;
  }

  if (request.action === 'delete_file' || request.action === 'delete_folder') {
    getAuthToken(true)
      .then(token => deleteDriveFile(token, request.fileId))
      .then(() => sendResponse({ status: 'ok' }))
      .catch(error => sendResponse({ status: 'error', message: error.message }));
    return true;
  }

  if (request.action === 'rename_file' || request.action === 'rename_folder') {
    getAuthToken(true)
      .then(token => renameDriveFile(token, request.fileId, request.newName))
      .then(result => sendResponse({ status: 'ok', data: result }))
      .catch(error => sendResponse({ status: 'error', message: error.message }));
    return true;
  }

  if (request.action === 'ask_ai') {
    queryAI(null, request.prompt, request.context)
      .then(answer => sendResponse({ status: 'ok', answer }))
      .catch(error => sendResponse({ status: 'error', message: error.message }));
    return true; // async
  }

  if (request.action === 'login_drive') {
    getAuthToken(true)
      .then(() => sendResponse({ status: 'ok' }))
      .catch(error => sendResponse({ status: 'error', message: error.message }));
    return true;
  }
  
  if (request.action === 'logout_drive') {
    getAuthToken(false)
      .then(token => {
        return new Promise(resolve => {
          chrome.identity.removeCachedAuthToken({ token }, () => {
             fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, { method: 'POST' }).finally(resolve);
          });
        });
      })
      .then(() => chrome.storage.session.remove('library_cache'))
      .then(() => sendResponse({ status: 'ok' }))
      .catch(error => sendResponse({ status: 'error', message: error.message }));
    return true;
  }

  if (request.action === 'get_drive_quota') {
    getAuthToken(false)
      .then(token => getDriveQuota(token))
      .then(result => sendResponse({ status: 'ok', quota: result.storageQuota }))
      .catch(error => sendResponse({ status: 'error', message: error.message }));
    return true;
  }
});
