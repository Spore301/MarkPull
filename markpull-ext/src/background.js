import { getQueue, clearQueue } from './storage.js';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

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
async function getLibraryFiles(token) {
  const rootId = await getOrCreateFolder(token, 'MarkPull');
  const query = `'${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  
  const foldersRes = await fetch(`${DRIVE_API_URL}/files?q=${encodeURIComponent(query)}&fields=files(id, name)`, {
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
      const projFiles = filesData.files.map(f => ({ ...f, project: proj.name }));
      allFiles = allFiles.concat(projFiles);
    }
  }
  
  return { projects: projects.map(p => p.name), files: allFiles };
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

// 7. AI Integration (OpenRouter / Ollama)
async function queryAI(token, prompt, contextText, apiKeyOrHost) {
  // If the user pastes a URL (like http://localhost:11434), use Ollama
  if (apiKeyOrHost && apiKeyOrHost.startsWith('http')) {
    const payload = {
      model: "llama3", // default ollama model
      prompt: `Context Document: \n${contextText}\n\nUser Question: ${prompt}`,
      stream: false
    };
    const response = await fetch(`${apiKeyOrHost.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('Failed to connect to Ollama. Make sure it is running.');
    const data = await response.json();
    return data.response;
  }

  const finalKey = apiKeyOrHost ? apiKeyOrHost.trim() : "";
  if (!finalKey) throw new Error("Please paste your OpenRouter API key into the UI!");

  const url = "https://openrouter.ai/api/v1/chat/completions";

  const payload = {
    model: "qwen/qwen3.5-9b",
    messages: [
      { role: "system", content: `Context Document: \n${contextText}\n\n` },
      { role: "user", content: prompt }
    ]
  };

  const headers = { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${finalKey}`,
    'HTTP-Referer': 'https://markpull.app',
    'X-Title': 'MarkPull Extension'
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Failed to generate response');
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
    getAuthToken(true)
      .then(token => getLibraryFiles(token))
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

  if (request.action === 'delete_file') {
    getAuthToken(true)
      .then(token => deleteDriveFile(token, request.fileId))
      .then(() => sendResponse({ status: 'ok' }))
      .catch(error => sendResponse({ status: 'error', message: error.message }));
    return true;
  }

  if (request.action === 'ask_ai') {
    queryAI(null, request.prompt, request.context, request.apiKey)
      .then(answer => sendResponse({ status: 'ok', answer }))
      .catch(error => sendResponse({ status: 'error', message: error.message }));
    return true; // async
  }
});
