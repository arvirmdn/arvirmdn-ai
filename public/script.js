const messagesEl = document.getElementById('messages');
const emptyState = document.getElementById('emptyState');
const form = document.getElementById('composerForm');
const textInput = document.getElementById('textInput');
const sendBtn = document.getElementById('sendBtn');
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');
const attachmentTray = document.getElementById('attachmentTray');
const newChatBtn = document.getElementById('newChatBtn');

const zipModal = document.getElementById('zipModal');
const zipModalTitle = document.getElementById('zipModalTitle');
const zipModalBody = document.getElementById('zipModalBody');
const zipModalClose = document.getElementById('zipModalClose');

let history = []; // {role, content}
let pendingAttachments = []; // {name, size, isZip, path, entries, preview, includedEntries: {entryName: content}}

// ---- Textarea auto-resize ----
textInput.addEventListener('input', () => {
  textInput.style.height = 'auto';
  textInput.style.height = Math.min(textInput.scrollHeight, 160) + 'px';
});
textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

// ---- New chat ----
newChatBtn.addEventListener('click', () => {
  history = [];
  pendingAttachments = [];
  messagesEl.innerHTML = '';
  attachmentTray.innerHTML = '';
  emptyState.style.display = 'block';
});

// ---- Attach file ----
attachBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  fileInput.value = '';

  const chip = renderAttachmentChip({ name: file.name, size: file.size, uploading: true });

  try {
    const fd = new FormData();
    fd.append('file', file, file.name);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload gagal');

    data.includedEntries = {};
    pendingAttachments.push(data);
    updateAttachmentChip(chip, data);
  } catch (err) {
    chip.querySelector('.attachment-name').textContent = 'Gagal upload: ' + file.name;
    chip.querySelector('.attachment-name').style.color = 'var(--danger)';
    setTimeout(() => chip.remove(), 2500);
  }
});

function renderAttachmentChip(info) {
  const el = document.createElement('div');
  el.className = 'attachment-card';
  el.innerHTML = `
    <span class="attachment-name">${info.uploading ? 'Mengunggah ' + escapeHtml(info.name) + '...' : escapeHtml(info.name)}</span>
    <button type="button" title="Hapus">&times;</button>
  `;
  el.querySelector('button').addEventListener('click', () => {
    pendingAttachments = pendingAttachments.filter(a => a !== el._data);
    el.remove();
  });
  attachmentTray.appendChild(el);
  return el;
}

function updateAttachmentChip(chipEl, data) {
  chipEl._data = data;
  const sizeKb = (data.size / 1024).toFixed(1);
  let extra = '';
  if (data.isZip) {
    extra = `<button type="button" class="view-zip">Lihat isi (${(data.entries || []).length} file)</button>`;
  }
  chipEl.innerHTML = `
    <span class="attachment-name">${escapeHtml(data.name)} · ${sizeKb} KB</span>
    ${extra}
    <button type="button" title="Hapus">&times;</button>
  `;
  chipEl.querySelector('button[title="Hapus"]').addEventListener('click', () => {
    pendingAttachments = pendingAttachments.filter(a => a !== data);
    chipEl.remove();
  });
  if (data.isZip) {
    chipEl.querySelector('.view-zip').addEventListener('click', () => openZipModal(data));
  }
}

// ---- Zip modal ----
function openZipModal(data) {
  zipModalTitle.textContent = data.name;
  zipModalBody.innerHTML = '';

  if (data.zipError) {
    zipModalBody.textContent = data.zipError;
  } else {
    (data.entries || []).filter(e => !e.isDirectory).forEach(entry => {
      const row = document.createElement('div');
      row.className = 'zip-entry-row';
      const included = data.includedEntries[entry.entryName] !== undefined;
      row.innerHTML = `
        <div><span class="zip-entry-name">${escapeHtml(entry.entryName)}</span><span class="zip-entry-size">${(entry.size/1024).toFixed(1)} KB</span></div>
        <button type="button">${included ? 'Sudah disertakan' : 'Baca & sertakan'}</button>
      `;
      const btn = row.querySelector('button');
      btn.addEventListener('click', async () => {
        if (data.includedEntries[entry.entryName] !== undefined) return;
        btn.textContent = 'Membaca...';
        try {
          const res = await fetch('/api/upload/zip-entry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zipPath: data.path, entryName: entry.entryName })
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error);
          data.includedEntries[entry.entryName] = result.content;
          btn.textContent = 'Sudah disertakan';

          const pre = document.createElement('div');
          pre.className = 'zip-preview';
          pre.textContent = result.content;
          row.after(pre);
        } catch (e) {
          btn.textContent = 'Gagal, coba lagi';
        }
      });
      zipModalBody.appendChild(row);
    });
  }
  zipModal.classList.remove('hidden');
}
zipModalClose.addEventListener('click', () => zipModal.classList.add('hidden'));
zipModal.addEventListener('click', (e) => { if (e.target === zipModal) zipModal.classList.add('hidden'); });

// ---- Send message ----
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = textInput.value.trim();
  if (!text && pendingAttachments.length === 0) return;

  emptyState.style.display = 'none';

  // Bangun konteks lampiran jadi teks yang disisipkan ke pesan user
  let contextBlock = '';
  for (const att of pendingAttachments) {
    if (att.isZip) {
      const list = (att.entries || []).filter(e => !e.isDirectory).map(e => '- ' + e.entryName).join('\n');
      contextBlock += `\n\n[File ZIP terlampir: ${att.name}]\nDaftar isi:\n${list}\n`;
      for (const [entryName, content] of Object.entries(att.includedEntries || {})) {
        contextBlock += `\n--- Isi "${entryName}" ---\n${content}\n`;
      }
    } else if (att.preview) {
      contextBlock += `\n\n[File terlampir: ${att.name}]\n${att.preview}\n`;
    } else {
      contextBlock += `\n\n[File terlampir: ${att.name}] (tidak bisa dibaca sebagai teks)`;
    }
  }

  renderUserMessage(text, pendingAttachments);

  const userContent = text + contextBlock;
  history.push({ role: 'user', content: userContent });

  textInput.value = '';
  textInput.style.height = 'auto';
  pendingAttachments = [];
  attachmentTray.innerHTML = '';
  sendBtn.disabled = true;

  const thinkingEl = renderAssistantMessage('Berpikir...', true);

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'Kamu adalah asisten AI yang membantu, jawab dalam bahasa Indonesia kecuali diminta lain. Kamu bisa membaca isi file teks dan isi file zip yang dilampirkan user di dalam pesan mereka.' },
          ...history
        ]
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');

    thinkingEl.querySelector('.bubble').textContent = data.reply;
    thinkingEl.querySelector('.bubble').classList.remove('thinking');
    history.push({ role: 'assistant', content: data.reply });
  } catch (err) {
    thinkingEl.querySelector('.bubble').textContent = 'Error: ' + err.message;
    thinkingEl.querySelector('.bubble').classList.remove('thinking');
  } finally {
    sendBtn.disabled = false;
    scrollToBottom();
  }
});

function renderUserMessage(text, attachments) {
  const el = document.createElement('div');
  el.className = 'msg user';
  const chips = attachments.map(a => `<div class="file-chip">📎 ${escapeHtml(a.name)}</div>`).join('');
  el.innerHTML = `<div class="avatar">A</div><div class="bubble">${escapeHtml(text)}${chips}</div>`;
  messagesEl.appendChild(el);
  scrollToBottom();
}

function renderAssistantMessage(text, thinking = false) {
  const el = document.createElement('div');
  el.className = 'msg assistant';
  el.innerHTML = `<div class="avatar">AI</div><div class="bubble ${thinking ? 'thinking' : ''}">${escapeHtml(text)}</div>`;
  messagesEl.appendChild(el);
  scrollToBottom();
  return el;
}

function scrollToBottom() {
  const area = document.getElementById('chatArea');
  area.scrollTop = area.scrollHeight;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
