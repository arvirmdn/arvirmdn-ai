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
let pendingAttachments = []; // {name, size, isZip, entries, preview, includedEntries: {entryName: content}}

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
  const files = Array.from(fileInput.files || []);
  fileInput.value = '';
  if (files.length === 0) return;

  // Upload semua file yang dipilih secara paralel, masing-masing jadi lampiran sendiri
  files.forEach(uploadSingleFile);
});

async function uploadSingleFile(file) {
  const chip = renderAttachmentChip({ name: file.name, size: file.size, uploading: true });

  try {
    const fd = new FormData();
    fd.append('file', file, file.name);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(`Server merespons dengan format tidak terduga (status ${res.status}).`);
    }
    if (!res.ok) throw new Error(data.error || 'Upload gagal');

    pendingAttachments.push(data);
    updateAttachmentChip(chip, data);
  } catch (err) {
    chip.querySelector('.attachment-name').textContent = 'Gagal: ' + err.message;
    chip.querySelector('.attachment-name').style.color = 'var(--danger)';
    setTimeout(() => chip.remove(), 4500);
  }
}

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
  const thumb = data.isImage ? `<img class="attachment-thumb" src="${data.dataUrl}" alt="">` : '';
  chipEl.innerHTML = `
    ${thumb}
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

// ---- Zip modal (cuma buat lihat isinya — semua file teks otomatis sudah dikirim ke AI) ----
function openZipModal(data) {
  zipModalTitle.textContent = data.name;
  zipModalBody.innerHTML = '';

  if (data.zipError) {
    zipModalBody.textContent = data.zipError;
  } else {
    (data.entries || []).filter(e => !e.isDirectory).forEach(entry => {
      const row = document.createElement('div');
      row.className = 'zip-entry-row';
      const status = entry.content !== undefined
        ? '<span class="zip-entry-status ok">✓ Otomatis dibaca AI</span>'
        : '<span class="zip-entry-status">Tidak dibaca (terlalu besar / bukan file teks)</span>';
      row.innerHTML = `
        <div><span class="zip-entry-name">${escapeHtml(entry.entryName)}</span><span class="zip-entry-size">${(entry.size/1024).toFixed(1)} KB</span></div>
        ${status}
      `;
      if (entry.content !== undefined) {
        const pre = document.createElement('div');
        pre.className = 'zip-preview';
        pre.textContent = entry.content;
        row.appendChild(pre);
      }
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

  // Bangun konteks lampiran jadi teks yang disisipkan ke pesan user (kecuali gambar, ditangani terpisah)
  const imageAttachments = pendingAttachments.filter(a => a.isImage);
  let contextBlock = '';
  for (const att of pendingAttachments) {
    if (att.isImage) continue;
    if (att.isZip) {
      const list = (att.entries || []).filter(e => !e.isDirectory).map(e => '- ' + e.entryName).join('\n');
      contextBlock += `\n\n[File ZIP terlampir: ${att.name}]\nDaftar isi:\n${list}\n`;
      // Semua file teks yang berhasil dibaca server otomatis disertakan, tanpa perlu klik manual
      (att.entries || []).filter(e => !e.isDirectory && e.content !== undefined).forEach(e => {
        contextBlock += `\n--- Isi "${e.entryName}" ---\n${e.content}\n`;
      });
    } else if (att.preview) {
      contextBlock += `\n\n[File terlampir: ${att.name}]\n${att.preview}\n`;
    } else {
      contextBlock += `\n\n[File terlampir: ${att.name}] (tidak bisa dibaca sebagai teks)`;
    }
  }

  renderUserMessage(text, pendingAttachments);

  const fullText = text + contextBlock;
  let userContent;
  if (imageAttachments.length > 0) {
    // Format multimodal: teks + gambar dalam satu pesan, supaya model vision bisa "melihat" fotonya
    userContent = [];
    if (fullText.trim()) userContent.push({ type: 'text', text: fullText });
    imageAttachments.forEach(img => {
      userContent.push({ type: 'image_url', image_url: { url: img.dataUrl } });
    });
  } else {
    userContent = fullText;
  }
  const userMessage = { role: 'user', content: userContent };
  history.push(userMessage);

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
      body: JSON.stringify({ messages: history })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');

    thinkingEl.querySelector('.bubble').classList.remove('thinking');
    renderMarkdown(thinkingEl.querySelector('.bubble'), data.reply);
    if (data.zipBase64) {
      renderZipDownload(thinkingEl, data.zipBase64, data.zipName, data.files);
    }
    // Setelah AI selesai menganalisis foto, ganti isi pesan bergambar di riwayat jadi teks ringkas saja.
    // Supaya foto (base64, bisa beberapa MB) tidak ikut terkirim ulang di setiap pesan berikutnya.
    if (Array.isArray(userMessage.content)) {
      const textPart = userMessage.content.find(c => c.type === 'text');
      const imgCount = userMessage.content.filter(c => c.type === 'image_url').length;
      userMessage.content = (textPart ? textPart.text + '\n' : '') + `[${imgCount} foto terlampir — sudah dijelaskan AI di atas]`;
    }
    history.push({ role: 'assistant', content: data.rawReply || data.reply });
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
  const chips = attachments.map(a => a.isImage
    ? `<img class="msg-image" src="${a.dataUrl}" alt="${escapeHtml(a.name)}">`
    : `<div class="file-chip">📎 ${escapeHtml(a.name)}</div>`
  ).join('');
  el.innerHTML = `<div class="avatar">A</div><div class="bubble"><div class="user-text">${escapeHtml(text)}</div>${chips}</div>`;
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

function renderMarkdown(bubbleEl, text) {
  try {
    const html = marked.parse(text, { breaks: true });
    bubbleEl.innerHTML = DOMPurify.sanitize(html);
  } catch (e) {
    bubbleEl.textContent = text;
  }
}

function renderZipDownload(msgEl, zipBase64, zipName, files) {
  const bubble = msgEl.querySelector('.bubble');
  const box = document.createElement('div');
  box.className = 'zip-download-box';

  const fileList = (files || []).map(f => `<div class="zip-download-file">📄 ${escapeHtml(f.name)}</div>`).join('');

  box.innerHTML = `
    <div class="zip-download-files">${fileList}</div>
    <a class="zip-download-btn" download="${escapeHtml(zipName || 'kode.zip')}">
      ⬇ Download ${escapeHtml(zipName || 'kode.zip')}
    </a>
  `;

  try {
    const byteChars = atob(zipBase64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    box.querySelector('.zip-download-btn').href = url;
  } catch (e) {
    box.querySelector('.zip-download-btn').textContent = 'Gagal menyiapkan file zip';
  }

  bubble.appendChild(box);
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
