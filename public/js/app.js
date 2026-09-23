/**
 * Image Batch Studio — Dashboard Application
 * Complete frontend JS with sidebar nav, WebSocket, gallery, lightbox, moodboard.
 */

// ─── State ───
let ws = null;
let currentPage = 'setup';
let parsedPrompts = [];
let referenceImages = [];
let batchRunning = false;
let styleApproved = false;
let currentBatchName = '';
let reviewImagePath = '';
let reviewPromptIndex = 0;

// Gallery / Lightbox state
let galleryBatches = [];
let lightboxImages = [];
let lightboxIndex = 0;
let lightboxBatchName = '';

// Moodboard state
let mbParsedPrompts = [];
let mbReferenceImages = [];

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupSetup();
  setupReview();
  setupQueue();
  setupGallery();
  setupLightbox();
  setupMoodboard();
  connectWebSocket();
});

// ═══════════════════════════════════════════
// Navigation
// ═══════════════════════════════════════════
const stepOrder = ['setup', 'review', 'queue', 'gallery'];

function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => showPage(btn.dataset.page));
  });
}

function showPage(name) {
  currentPage = name;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === name));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + name));

  const idx = stepOrder.indexOf(name);
  if (idx >= 0) {
    document.querySelectorAll('.step').forEach((s, i) => {
      s.classList.remove('done', 'current');
      if (i < idx) s.classList.add('done');
      else if (i === idx) s.classList.add('current');
    });
    document.querySelectorAll('.step-line').forEach((l, i) => {
      l.classList.toggle('done', i < idx);
    });
  }

  if (name === 'gallery') loadGallery();
}

function updateContextBar() {
  const el = document.getElementById('ctx-batchname');
  const sub = document.getElementById('ctx-sub');
  if (currentBatchName) {
    el.textContent = currentBatchName;
    const refCount = referenceImages.length;
    const promptCount = parsedPrompts.length;
    sub.textContent = `${promptCount} prompts · ${refCount} references · 30 per chat`;
  }
}

// ═══════════════════════════════════════════
// WebSocket
// ═══════════════════════════════════════════
function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.onopen = () => {
    document.getElementById('ws-dot').className = 'dot on';
    document.getElementById('ws-status').textContent = 'Chrome · CDP · connected';
  };

  ws.onclose = () => {
    document.getElementById('ws-dot').className = 'dot off';
    document.getElementById('ws-status').textContent = 'Disconnected';
    setTimeout(connectWebSocket, 3000);
  };

  ws.onmessage = (event) => {
    try { handleEvent(JSON.parse(event.data)); }
    catch (err) { console.error('WS message error:', err); }
  };
}

function handleEvent(event) {
  switch (event.type) {
    case 'batch_started':
      showToast('Batch started!', 'success');
      batchRunning = true;
      updateQueueControls();
      break;

    case 'job_started':
      updateJobState(event.promptIndex, 'generating');
      break;

    case 'job_completed':
      updateJobState(event.promptIndex, 'completed');
      showToast(`Image ${event.promptIndex} completed`, 'success');
      refreshProgress();
      break;

    case 'job_failed':
      updateJobState(event.promptIndex, 'failed');
      showToast(`Image ${event.promptIndex} failed: ${event.error}`, 'error');
      refreshProgress();
      break;

    case 'job_retry_requested':
      updateJobState(event.promptIndex, 'generating');
      showToast(`Retrying image ${event.promptIndex}…`, 'info');
      break;

    case 'awaiting_review':
      showReviewReady(event.imagePath, event.promptIndex);
      showPage('review');
      showToast('First image ready for review!', 'info');
      document.getElementById('review-badge').style.display = '';
      document.getElementById('review-badge').textContent = '1';
      break;

    case 'style_approved':
      styleApproved = true;
      showReviewLocked();
      showToast('Style approved & locked!', 'success');
      document.getElementById('review-badge').style.display = 'none';
      break;

    case 'style_rejected':
      showToast('Style rejected — revising...', 'warning');
      showReviewWaiting();
      break;

    case 'new_chat_started':
      showToast(`New chat started (#${event.chatNumber})`, 'info');
      break;

    case 'batch_paused':
      batchRunning = false;
      updateQueueControls();
      showToast(`Batch paused: ${event.reason}`, 'warning');
      break;

    case 'batch_completed':
      batchRunning = false;
      updateQueueControls();
      showToast(`Batch complete! ${event.totalCompleted} images generated`, 'success');
      break;

    case 'progress_update':
      updateProgress(event.progress);
      break;

    case 'error':
      showToast(event.error, 'error');
      break;
  }
}

// ═══════════════════════════════════════════
// Setup Page
// ═══════════════════════════════════════════
function setupSetup() {
  // Scan references
  document.getElementById('btn-scan-refs').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/references');
      const data = await res.json();
      referenceImages = data.images || [];
      renderReferenceThumbs();
      showToast(`Found ${referenceImages.length} reference image(s)`, 'info');
      updateChecklist();
    } catch (err) {
      showToast(`Scan failed: ${err.message}`, 'error');
    }
  });

  // Scan moodboard images (for REFS on setup page)
  document.getElementById('btn-scan-moodboard-images').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/scan-folder/moodboard');
      const data = await res.json();
      const images = data.images || [];
      renderSetupMoodboardImages(images);
      showToast(`Found ${images.length} moodboard image(s) in MOODBOARD_IMAGES/`, 'info');
    } catch (err) {
      showToast(`Scan failed: ${err.message}`, 'error');
    }
  });

  // Fetch from IMAGE_PROMPTS folder
  document.getElementById('btn-fetch-image-prompts').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/image-prompts/read');
      const data = await res.json();
      if (data.content) {
        document.getElementById('prompts-input').value = data.content;
        parsedPrompts = data.prompts || [];
        const pill = document.getElementById('prompt-count-pill');
        pill.style.display = '';
        pill.textContent = `${parsedPrompts.length} parsed`;
        updateChecklist();
        showToast(`Loaded ${parsedPrompts.length} prompts from IMAGE_PROMPTS/`, 'success');
      } else {
        showToast('No prompts found in IMAGE_PROMPTS/ folder', 'warning');
      }
    } catch (err) {
      showToast(`Fetch failed: ${err.message}`, 'error');
    }
  });

  // Upload ZIP file (setup page — looks for images.md)
  document.getElementById('btn-load-zip').addEventListener('click', () => {
    document.getElementById('file-input').click();
  });
  document.getElementById('file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await uploadZipFile(file, 'images', 'prompts-input', 'prompt-count-pill');
    e.target.value = ''; // reset
  });

  // Parse prompts
  document.getElementById('btn-parse').addEventListener('click', async () => {
    const text = document.getElementById('prompts-input').value;
    if (!text.trim()) { showToast('Please enter or load prompts first', 'warning'); return; }

    try {
      const res = await fetch('/api/parse-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      parsedPrompts = data.prompts || [];
      if (!data.valid) showToast(`Validation issues: ${data.errors.join(', ')}`, 'warning');

      const pill = document.getElementById('prompt-count-pill');
      pill.style.display = '';
      pill.textContent = `${parsedPrompts.length} parsed`;

      updateChecklist();
      showToast(`Parsed ${parsedPrompts.length} prompt(s)`, 'success');
    } catch (err) {
      showToast(`Parse failed: ${err.message}`, 'error');
    }
  });

  // Launch browser
  document.getElementById('btn-launch-browser').addEventListener('click', async () => {
    const btn = document.getElementById('btn-launch-browser');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;"></div>Launching…';

    try {
      const res = await fetch('/api/batch/launch-browser', { method: 'POST' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      document.getElementById('browser-status-row').style.display = 'flex';
      document.getElementById('browser-status-text').textContent = `Connected to ChatGPT — ${data.accountName || 'logged in'}`;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M5 12l5 5L20 7"/></svg>Session ready';
      updateChecklist();
      updateMBChecklist();
    } catch (err) {
      showToast(`Browser launch failed: ${err.message}`, 'error');
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>Launch browser';
    }
    btn.disabled = false;
  });

  // Start batch — always batchType='script'
  document.getElementById('btn-start-batch').addEventListener('click', async () => {
    currentBatchName = document.getElementById('batch-name').value || 'batch';
    const promptsText = document.getElementById('prompts-input').value;
    const browserType = document.getElementById('browser-type').value;

    if (!promptsText.trim()) { showToast('Please enter prompts first', 'warning'); return; }

    try {
      const setupRes = await fetch('/api/batch/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchName: currentBatchName,
          batchType: 'script',
          promptsText,
          referenceImagePaths: referenceImages.map(i => i.absolutePath),
          browserType,
        }),
      });
      const setupData = await setupRes.json();
      if (setupData.error) throw new Error(setupData.error);

      updateContextBar();
      showToast('Batch created — starting generation…', 'success');

      await fetch('/api/batch/start', { method: 'POST' });

      batchRunning = true;
      updateQueueControls();
      showPage('review');
      showReviewWaiting();
      refreshProgress();
    } catch (err) {
      showToast(`Start failed: ${err.message}`, 'error');
    }
  });
}

function renderReferenceThumbs() {
  const grid = document.getElementById('reference-gallery');
  grid.innerHTML = referenceImages.map(img =>
    `<div class="thumb"><img src="/reference-images/${encodeURIComponent(img.filename)}" alt="${esc(img.filename)}" loading="lazy"></div>`
  ).join('');
  document.getElementById('ref-count').textContent = `${referenceImages.length} references detected`;
}

function renderSetupMoodboardImages(images) {
  const grid = document.getElementById('setup-moodboard-gallery');
  grid.innerHTML = images.map(img =>
    `<div class="thumb" style="position:relative;">
      <img src="/api/output-image/moodboard/${encodeURIComponent(img.filename)}/download" alt="${esc(img.imageId)}" loading="lazy">
      <div style="position:absolute; bottom:2px; left:2px; right:2px; background:rgba(0,0,0,0.6); color:#fff; font-size:10px; padding:2px 4px; border-radius:3px; text-align:center;">${esc(img.imageId)}</div>
    </div>`
  ).join('');
  document.getElementById('setup-moodboard-count').textContent = `${images.length} moodboard images found`;
}

function updateChecklist() {
  const refs = referenceImages.length > 0;
  const browser = document.getElementById('browser-status-row').style.display !== 'none';
  const prompts = parsedPrompts.length > 0;

  setCheckDone('check-refs', refs, `${referenceImages.length} reference images loaded`);
  setCheckDone('check-browser', browser, 'Browser session connected');
  setCheckDone('check-prompts', prompts, `${parsedPrompts.length} prompts parsed and validated`);

  document.getElementById('btn-start-batch').disabled = !(refs && prompts);
}

function setCheckDone(id, done, text) {
  const el = document.getElementById(id);
  if (!el) return;
  if (done) {
    el.className = 'check-row done';
    el.innerHTML = `<span class="check-mark"><svg viewBox="0 0 24 24" fill="none" stroke-width="3"><path d="M4 12l5 5L20 6"/></svg></span>${text}`;
  } else {
    el.className = 'check-row';
    el.innerHTML = `<span class="check-mark"></span>${text}`;
  }
}

// ═══════════════════════════════════════════
// ZIP Upload (shared between setup & moodboard)
// ═══════════════════════════════════════════
async function uploadZipFile(file, target, textareaId, pillId) {
  const formData = new FormData();
  formData.append('zipfile', file);
  formData.append('target', target);

  try {
    showToast(`Uploading ${file.name}…`, 'info');
    const res = await fetch('/api/upload-zip', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();

    if (data.error) {
      showToast(`ZIP error: ${data.error}`, 'error');
      if (data.availableFiles) {
        console.log('Files found in ZIP:', data.availableFiles);
      }
      return;
    }

    document.getElementById(textareaId).value = data.content;

    const prompts = data.prompts || [];
    if (target === 'images') {
      parsedPrompts = prompts;
      updateChecklist();
    } else {
      mbParsedPrompts = prompts;
      updateMBChecklist();
    }

    const pill = document.getElementById(pillId);
    pill.style.display = '';
    pill.textContent = `${prompts.length} parsed`;

    showToast(`Extracted ${data.filename} — ${prompts.length} prompts found`, 'success');
  } catch (err) {
    showToast(`Upload failed: ${err.message}`, 'error');
  }
}

// ═══════════════════════════════════════════
// Review Page
// ═══════════════════════════════════════════
function setupReview() {
  document.getElementById('btn-approve').addEventListener('click', async () => {
    try {
      await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true }),
      });
      showToast('Style approved!', 'success');
    } catch (err) {
      showToast(`Approve failed: ${err.message}`, 'error');
    }
  });

  document.getElementById('btn-reject').addEventListener('click', async () => {
    const revisionText = document.getElementById('revision-text').value;
    try {
      await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: false, revisionInstructions: revisionText || 'Please regenerate with a different approach.' }),
      });
      document.getElementById('revision-text').value = '';
      showToast('Rejected — regenerating…', 'info');
    } catch (err) {
      showToast(`Reject failed: ${err.message}`, 'error');
    }
  });

  document.getElementById('btn-regenerate').addEventListener('click', async () => {
    const revisionText = document.getElementById('revision-text').value;
    try {
      await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: false, revisionInstructions: revisionText || '' }),
      });
      document.getElementById('revision-text').value = '';
      showToast('Regenerating…', 'info');
    } catch (err) {
      showToast(`Regenerate failed: ${err.message}`, 'error');
    }
  });
}

function showReviewWaiting() {
  document.getElementById('review-state-waiting').style.display = '';
  document.getElementById('review-state-ready').style.display = 'none';
  document.getElementById('review-state-locked').style.display = 'none';
  renderReviewReferences('review-references');

  if (parsedPrompts.length > 0) {
    document.getElementById('review-current-prompt').textContent = parsedPrompts[0].originalText;
  }
}

function showReviewReady(imagePath, promptIndex) {
  document.getElementById('review-state-waiting').style.display = 'none';
  document.getElementById('review-state-ready').style.display = '';
  document.getElementById('review-state-locked').style.display = 'none';

  reviewImagePath = imagePath;
  reviewPromptIndex = promptIndex;

  const imgUrl = buildImageUrl(imagePath);
  document.getElementById('review-image').src = imgUrl;

  if (parsedPrompts.length > 0) {
    document.getElementById('review-original-prompt').textContent = parsedPrompts[0].originalText;
  }

  renderReviewReferences('review-references-ready');
}

function showReviewLocked() {
  document.getElementById('review-state-waiting').style.display = 'none';
  document.getElementById('review-state-ready').style.display = 'none';
  document.getElementById('review-state-locked').style.display = '';

  if (reviewImagePath) {
    document.getElementById('locked-image').src = buildImageUrl(reviewImagePath);
  }
  if (parsedPrompts.length > 0) {
    document.getElementById('locked-prompt').textContent = parsedPrompts[0].originalText;
  }
}

function renderReviewReferences(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = referenceImages.map(img =>
    `<div class="ref-thumb"><img src="/reference-images/${encodeURIComponent(img.filename)}" alt="${esc(img.filename)}" loading="lazy"></div>`
  ).join('');
}

function buildImageUrl(imagePath) {
  if (!imagePath) return '';
  if (imagePath.includes('batches\\') || imagePath.includes('batches/')) {
    const relative = imagePath.split(/batches[/\\]/)[1];
    if (relative) return `/batches/${relative.replace(/\\/g, '/')}`;
  }
  if (imagePath.includes('MOODBOARD_IMAGES')) {
    const filename = imagePath.split(/[/\\]/).pop();
    return `/api/output-image/moodboard/${filename}/download`;
  }
  if (imagePath.includes('SCRIPT_IMAGES')) {
    const filename = imagePath.split(/[/\\]/).pop();
    return `/api/output-image/script/${filename}/download`;
  }
  return imagePath;
}

// ═══════════════════════════════════════════
// Queue Page
// ═══════════════════════════════════════════
function setupQueue() {
  document.getElementById('btn-pause').addEventListener('click', async () => {
    await fetch('/api/batch/pause', { method: 'POST' });
    batchRunning = false;
    updateQueueControls();
  });

  document.getElementById('btn-resume').addEventListener('click', async () => {
    await fetch('/api/batch/resume', { method: 'POST' });
    batchRunning = true;
    updateQueueControls();
  });

  document.getElementById('btn-cancel').addEventListener('click', async () => {
    if (confirm('Cancel the current batch?')) {
      await fetch('/api/batch/cancel', { method: 'POST' });
      batchRunning = false;
      updateQueueControls();
    }
  });

  setInterval(refreshProgress, 5000);
}

function updateQueueControls() {
  document.getElementById('btn-pause').disabled = !batchRunning;
  document.getElementById('btn-resume').disabled = batchRunning;
  document.getElementById('btn-cancel').disabled = !batchRunning;
}

async function refreshProgress() {
  try {
    const res = await fetch('/api/batch/progress');
    const data = await res.json();
    if (data.progress) updateProgress(data.progress);
  } catch (err) { /* silent */ }
}

function updateProgress(progress) {
  if (!progress) return;

  const total = progress.totalPrompts || 1;
  const completed = progress.completedCount || 0;
  const failed = progress.failedCount || 0;
  const pct = Math.round((completed / total) * 100);

  document.getElementById('q-progress-fill').style.width = `${pct}%`;
  document.getElementById('q-progress-text').textContent = `${completed} / ${total} completed`;
  document.getElementById('q-failed-text').textContent = failed > 0 ? `${failed} failed` : '';
  document.getElementById('q-total-pill').textContent = `${total} total`;

  const badge = document.getElementById('queue-badge');
  if (progress.state === 'running') {
    badge.style.display = '';
    badge.textContent = `${completed}/${total}`;
  }

  const statusPill = document.getElementById('q-status-pill');
  const state = progress.state || 'setup';
  statusPill.className = 'pill';
  if (state === 'running') { statusPill.className = 'pill accent pulsing'; statusPill.innerHTML = '<span class="dotm"></span>Running'; }
  else if (state === 'paused') { statusPill.className = 'pill warning'; statusPill.innerHTML = '<span class="dotm"></span>Paused'; }
  else if (state === 'completed') { statusPill.className = 'pill success'; statusPill.innerHTML = '<span class="dotm"></span>Complete'; }
  else if (state === 'interrupted') { statusPill.className = 'pill warning'; statusPill.innerHTML = '<span class="dotm"></span>Interrupted'; }
  else { statusPill.textContent = state; }

  renderJobList(progress.jobs || []);

  const currentJob = (progress.jobs || []).find(j => j.state === 'generating');
  if (currentJob) {
    document.getElementById('q-current-label').textContent = `Prompt ${currentJob.promptIndex} of ${total}`;
    document.getElementById('q-current-prompt').textContent = currentJob.originalPrompt || '';

    if (currentJob.imagePath) {
      document.getElementById('q-current-image').innerHTML = `<img src="${buildImageUrl(currentJob.imagePath)}" alt="Current">`;
    } else {
      document.getElementById('q-current-image').innerHTML = '<div class="ph"><div class="spinner"></div></div>';
    }
  }

  const lastCompleted = [...(progress.jobs || [])].reverse().find(j => j.state === 'completed' && j.imagePath);
  if (lastCompleted && !currentJob) {
    document.getElementById('q-current-image').innerHTML = `<img src="${buildImageUrl(lastCompleted.imagePath)}" alt="Last completed">`;
    document.getElementById('q-current-label').textContent = `Last completed: Prompt ${lastCompleted.promptIndex}`;
    document.getElementById('q-current-prompt').textContent = lastCompleted.originalPrompt || '';
  }
}

function updateJobState(promptIndex, state) {
  const row = document.querySelector(`[data-job-index="${promptIndex}"]`);
  if (!row) return;
  const pillEl = row.querySelector('.job-pill');
  if (pillEl) {
    pillEl.className = 'pill job-pill ' + getJobPillClass(state);
    pillEl.innerHTML = getJobPillContent(state);
  }
  // Update action buttons based on state
  let actionsEl = row.querySelector('.job-actions');
  if (state === 'failed' || state === 'completed') {
    if (!actionsEl) {
      actionsEl = document.createElement('div');
      actionsEl.className = 'job-actions';
      actionsEl.style.opacity = '1';
      row.appendChild(actionsEl);
    }
    if (state === 'failed') {
      actionsEl.innerHTML = `
        <button class="btn btn-ghost btn-sm" onclick="retryJob(${promptIndex})">Retry</button>
        <button class="btn btn-ghost btn-sm btn-regen" onclick="regenerateJob(${promptIndex})">Regenerate</button>
        <button class="btn btn-ghost btn-sm" onclick="skipJob(${promptIndex})">Skip</button>
      `;
    } else {
      actionsEl.innerHTML = `
        <button class="btn btn-ghost btn-sm btn-regen" onclick="regenerateJob(${promptIndex})">⟳ Regenerate</button>
      `;
    }
  } else if (state === 'generating') {
    if (actionsEl) actionsEl.remove();
  }
}

function renderJobList(jobs) {
  const container = document.getElementById('job-list');
  container.innerHTML = jobs.map(job => {
    const isActive = job.state === 'generating';
    const imageId = job.imageId || `IMG-${String(job.promptIndex).padStart(3, '0')}`;
    const name = job.originalPrompt ? job.originalPrompt.substring(0, 40) : `Prompt ${job.promptIndex}`;
    const showRegen = job.state === 'completed' || job.state === 'failed';
    const showRetrySkip = job.state === 'failed';
    return `
      <div class="job-row${isActive ? ' active' : ''}" data-job-index="${job.promptIndex}">
        <span class="job-idx">${esc(imageId)}</span>
        <span class="job-name">${esc(name)}</span>
        <span class="pill job-pill ${getJobPillClass(job.state)}">${getJobPillContent(job.state)}</span>
        ${showRegen || showRetrySkip ? `
          <div class="job-actions" style="opacity:1;">
            ${showRetrySkip ? `<button class="btn btn-ghost btn-sm" onclick="retryJob(${job.promptIndex})">Retry</button>` : ''}
            ${showRegen ? `<button class="btn btn-ghost btn-sm btn-regen" onclick="regenerateJob(${job.promptIndex})">⟳ Regenerate</button>` : ''}
            ${showRetrySkip ? `<button class="btn btn-ghost btn-sm" onclick="skipJob(${job.promptIndex})">Skip</button>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function getJobPillClass(state) {
  switch (state) {
    case 'completed': return 'success';
    case 'failed': return 'danger';
    case 'generating': return 'accent pulsing';
    case 'awaiting_review': return 'accent';
    case 'approved': return 'success';
    case 'paused': return 'warning';
    default: return '';
  }
}

function getJobPillContent(state) {
  switch (state) {
    case 'completed': return 'Done';
    case 'failed': return 'Failed';
    case 'generating': return '<span class="dotm"></span>Running';
    case 'awaiting_review': return 'Review';
    case 'approved': return 'Approved';
    case 'paused': return 'Paused';
    case 'pending': return 'Pending';
    case 'skipped': return 'Skipped';
    default: return state;
  }
}

async function retryJob(promptIndex) {
  try {
    const res = await fetch('/api/batch/retry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptIndex }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    showToast(`Retrying prompt ${promptIndex} — re-generating with full context…`, 'info');
    updateJobState(promptIndex, 'generating');
  } catch (err) {
    showToast(`Retry failed: ${err.message}`, 'error');
  }
}

async function regenerateJob(promptIndex) {
  try {
    const res = await fetch('/api/batch/regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptIndex }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    showToast(`Regenerating image ${promptIndex} — opening new chat with full context…`, 'info');
    updateJobState(promptIndex, 'generating');
  } catch (err) {
    showToast(`Regenerate failed: ${err.message}`, 'error');
  }
}

async function skipJob(promptIndex) {
  try {
    await fetch('/api/batch/skip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptIndex }),
    });
    showToast(`Skipped prompt ${promptIndex}`, 'info');
  } catch (err) {
    showToast(`Skip failed: ${err.message}`, 'error');
  }
}

// ═══════════════════════════════════════════
// Gallery Page
// ═══════════════════════════════════════════
function setupGallery() {
  document.getElementById('btn-refresh-gallery').addEventListener('click', loadGallery);
  document.getElementById('gallery-search').addEventListener('input', filterGallery);
  document.getElementById('gallery-sort').addEventListener('change', () => renderGalleryBatches(galleryBatches));
  loadGallery();
}

async function loadGallery() {
  try {
    const res = await fetch('/api/batches');
    const data = await res.json();
    galleryBatches = data.batches || [];
    renderGalleryBatches(galleryBatches);
  } catch (err) {
    console.error('Gallery load failed:', err);
  }
}

function filterGallery() {
  const q = document.getElementById('gallery-search').value.toLowerCase();
  const filtered = galleryBatches.filter(b => b.name.toLowerCase().includes(q));
  renderGalleryBatches(filtered);
}

function renderGalleryBatches(batches) {
  const container = document.getElementById('gallery-batches');
  const sortOrder = document.getElementById('gallery-sort').value;

  const sorted = [...batches].sort((a, b) => {
    if (sortOrder === 'newest') return b.name.localeCompare(a.name);
    return a.name.localeCompare(b.name);
  });

  // FILTER: Only show batches that have at least 1 completed image
  const nonEmpty = sorted.filter(batch => {
    const jobs = batch.progress?.jobs || [];
    return jobs.some(j => j.state === 'completed' && j.imagePath);
  });

  if (nonEmpty.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        <h3>No batches with images yet</h3>
        <p>Start a batch from the Setup page to see images here.</p>
      </div>
    `;
    document.getElementById('gallery-stats').textContent = '';
    return;
  }

  let totalImages = 0;
  container.innerHTML = nonEmpty.map(batch => {
    const p = batch.progress;
    const completed = p?.completedCount || 0;
    const total = p?.totalPrompts || 0;
    const state = p?.state || 'unknown';
    const batchType = p?.batchType || 'script';
    const jobs = p?.jobs || [];
    const completedJobs = jobs.filter(j => j.state === 'completed' && j.imagePath);
    totalImages += completedJobs.length;

    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    return `
      <div class="gallery-batch-card" id="batch-${esc(batch.name)}">
        <div class="gallery-batch-header" onclick="toggleBatch('${esc(batch.name)}')">
          <span class="gallery-batch-name">${esc(batch.name)}</span>
          <span class="pill" style="font-size:11px;">${batchType === 'moodboard' ? 'Moodboard' : 'Script'}</span>
          <div class="gallery-batch-meta">
            <span class="pill ${getStatePillClass(state)}">${getStatePillContent(state)}</span>
            <span style="color:var(--text-tertiary); font-size:13px;">${completedJobs.length} / ${total} images</span>
          </div>
        </div>
        <div class="progress-bar" style="height:3px; margin-bottom:16px;">
          <div class="progress-bar-fill" style="width:${pct}%;"></div>
        </div>
        <div class="gallery-grid">
          ${completedJobs.map((job, idx) => {
      const imgUrl = buildImageUrl(job.imagePath);
      const imageId = job.imageId || `IMG-${String(job.promptIndex).padStart(3, '0')}`;
      return `
              <div class="gallery-image-card" onclick="openLightbox('${esc(batch.name)}', ${idx})">
                <img src="${imgUrl}" alt="${esc(imageId)}" loading="lazy">
                <button class="img-download" onclick="event.stopPropagation(); downloadBatchImage('${esc(batch.name)}', '${esc(job.imageFilename)}')">
                  <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  ${esc(imageId)}
                </button>
              </div>
            `;
    }).join('')}
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('gallery-stats').textContent = `${nonEmpty.length} batches · ${totalImages} images`;
}

function getStatePillClass(state) {
  switch (state) {
    case 'completed': return 'success';
    case 'running': return 'accent pulsing';
    case 'paused': case 'cancelled': return 'warning';
    case 'interrupted': return 'warning';
    case 'failed': return 'danger';
    default: return '';
  }
}

function getStatePillContent(state) {
  switch (state) {
    case 'completed': return 'Completed';
    case 'running': return '<span class="dotm"></span>Running';
    case 'paused': return 'Paused';
    case 'cancelled': return 'Cancelled';
    case 'interrupted': return 'Interrupted';
    case 'failed': return 'Failed';
    default: return state;
  }
}

function toggleBatch(batchName) {
  const card = document.getElementById('batch-' + batchName);
  if (card) card.classList.toggle('expanded');
}

function downloadBatchImage(batchName, filename) {
  const url = `/api/batch/${encodeURIComponent(batchName)}/images/${encodeURIComponent(filename)}/download`;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  showToast(`Downloading ${filename}`, 'info');
}

// ═══════════════════════════════════════════
// Lightbox
// ═══════════════════════════════════════════
function setupLightbox() {
  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('lightbox-prev').addEventListener('click', () => navigateLightbox(-1));
  document.getElementById('lightbox-next').addEventListener('click', () => navigateLightbox(1));
  document.getElementById('lightbox-download').addEventListener('click', downloadLightboxImage);

  document.getElementById('lightbox').addEventListener('click', (e) => {
    if (e.target.id === 'lightbox' || e.target.classList.contains('lightbox-overlay')) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('lightbox').classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
    if (e.key === 'ArrowRight') navigateLightbox(1);
  });
}

function openLightbox(batchName, imageIndex) {
  const batch = galleryBatches.find(b => b.name === batchName);
  if (!batch || !batch.progress) return;

  lightboxBatchName = batchName;
  const completedJobs = (batch.progress.jobs || []).filter(j => j.state === 'completed' && j.imagePath);
  lightboxImages = completedJobs.map(job => ({
    url: buildImageUrl(job.imagePath),
    prompt: job.originalPrompt || '',
    index: job.promptIndex,
    imageId: job.imageId || `IMG-${String(job.promptIndex).padStart(3, '0')}`,
    filename: job.imageFilename || '',
  }));

  if (lightboxImages.length === 0) return;

  lightboxIndex = Math.min(imageIndex, lightboxImages.length - 1);
  updateLightboxImage();
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}

function navigateLightbox(dir) {
  lightboxIndex += dir;
  if (lightboxIndex < 0) lightboxIndex = lightboxImages.length - 1;
  if (lightboxIndex >= lightboxImages.length) lightboxIndex = 0;
  updateLightboxImage();
}

function updateLightboxImage() {
  const img = lightboxImages[lightboxIndex];
  if (!img) return;
  document.getElementById('lightbox-img').src = img.url;
  // Show proper imageId (MB-CHAR-01 for moodboard, IMG-001 for script)
  document.getElementById('lightbox-info').textContent = `${img.imageId}`;

  // Show/hide regenerate button in lightbox
  let regenBtn = document.getElementById('lightbox-regenerate');
  if (!regenBtn) {
    // Create the regenerate button dynamically if not in HTML
    regenBtn = document.createElement('button');
    regenBtn.id = 'lightbox-regenerate';
    regenBtn.className = 'btn btn-ghost btn-regen';
    regenBtn.innerHTML = '⟳ Regenerate';
    regenBtn.style.cssText = 'margin-left:8px; color:#f59e0b; border-color:#f59e0b;';
    regenBtn.addEventListener('click', regenerateLightboxImage);
    const controls = document.querySelector('.lightbox-controls');
    if (controls) controls.appendChild(regenBtn);
  }
}

function downloadLightboxImage() {
  const img = lightboxImages[lightboxIndex];
  if (!img || !img.filename) return;
  downloadBatchImage(lightboxBatchName, img.filename);
}

async function regenerateLightboxImage() {
  const img = lightboxImages[lightboxIndex];
  if (!img) return;
  try {
    const res = await fetch('/api/batch/regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptIndex: img.index }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    showToast(`Regenerating ${img.imageId} — opening new chat…`, 'info');
    closeLightbox();
  } catch (err) {
    showToast(`Regenerate failed: ${err.message}`, 'error');
  }
}

// ═══════════════════════════════════════════
// Moodboard Page
// ═══════════════════════════════════════════
function setupMoodboard() {
  // Scan reference images
  document.getElementById('btn-mb-scan-refs').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/references');
      const data = await res.json();
      mbReferenceImages = data.images || [];
      renderMBReferenceThumbs();
      showToast(`Found ${mbReferenceImages.length} reference image(s)`, 'info');
      updateMBChecklist();
    } catch (err) {
      showToast(`Scan failed: ${err.message}`, 'error');
    }
  });

  // Fetch from MOODBOARD_PROMPTS folder
  document.getElementById('btn-fetch-moodboard-prompts').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/moodboard-prompts/read');
      const data = await res.json();
      if (data.content) {
        document.getElementById('mb-prompts-input').value = data.content;
        mbParsedPrompts = data.prompts || [];
        const pill = document.getElementById('mb-prompt-count-pill');
        pill.style.display = '';
        pill.textContent = `${mbParsedPrompts.length} parsed`;
        updateMBChecklist();
        showToast(`Loaded ${mbParsedPrompts.length} prompts from MOODBOARD_PROMPTS/`, 'success');
      } else {
        showToast('No prompts found in MOODBOARD_PROMPTS/ folder', 'warning');
      }
    } catch (err) {
      showToast(`Fetch failed: ${err.message}`, 'error');
    }
  });

  // Upload ZIP file (moodboard page — looks for moodboard.md)
  document.getElementById('btn-mb-load-zip').addEventListener('click', () => {
    document.getElementById('mb-file-input').click();
  });
  document.getElementById('mb-file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await uploadZipFile(file, 'moodboard', 'mb-prompts-input', 'mb-prompt-count-pill');
    e.target.value = '';
  });

  // Parse prompts
  document.getElementById('btn-mb-parse').addEventListener('click', async () => {
    const text = document.getElementById('mb-prompts-input').value;
    if (!text.trim()) { showToast('Please enter or load prompts first', 'warning'); return; }

    try {
      const res = await fetch('/api/parse-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      mbParsedPrompts = data.prompts || [];
      if (!data.valid) showToast(`Validation issues: ${data.errors.join(', ')}`, 'warning');

      const pill = document.getElementById('mb-prompt-count-pill');
      pill.style.display = '';
      pill.textContent = `${mbParsedPrompts.length} parsed`;

      updateMBChecklist();
      showToast(`Parsed ${mbParsedPrompts.length} moodboard prompt(s)`, 'success');
    } catch (err) {
      showToast(`Parse failed: ${err.message}`, 'error');
    }
  });

  // Start moodboard batch — always batchType='moodboard'
  document.getElementById('btn-mb-start-batch').addEventListener('click', async () => {
    const batchName = document.getElementById('mb-batch-name').value || 'moodboard-batch';
    const promptsText = document.getElementById('mb-prompts-input').value;
    const browserType = document.getElementById('browser-type').value;

    if (!promptsText.trim()) { showToast('Please enter prompts first', 'warning'); return; }

    try {
      const setupRes = await fetch('/api/batch/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchName,
          batchType: 'moodboard',
          promptsText,
          referenceImagePaths: mbReferenceImages.map(i => i.absolutePath),
          browserType,
        }),
      });
      const setupData = await setupRes.json();
      if (setupData.error) throw new Error(setupData.error);

      currentBatchName = batchName;
      updateContextBar();
      showToast('Moodboard batch created — starting generation…', 'success');

      await fetch('/api/batch/start', { method: 'POST' });

      batchRunning = true;
      updateQueueControls();
      showPage('review');
      showReviewWaiting();
      refreshProgress();
    } catch (err) {
      showToast(`Start failed: ${err.message}`, 'error');
    }
  });
}

function renderMBReferenceThumbs() {
  const grid = document.getElementById('mb-reference-gallery');
  grid.innerHTML = mbReferenceImages.map(img =>
    `<div class="thumb"><img src="/reference-images/${encodeURIComponent(img.filename)}" alt="${esc(img.filename)}" loading="lazy"></div>`
  ).join('');
  document.getElementById('mb-ref-count').textContent = `${mbReferenceImages.length} references detected`;
}

function updateMBChecklist() {
  const refs = mbReferenceImages.length > 0;
  const browser = document.getElementById('browser-status-row').style.display !== 'none';
  const prompts = mbParsedPrompts.length > 0;

  setCheckDone('mb-check-refs', refs, `${mbReferenceImages.length} reference images loaded`);
  setCheckDone('mb-check-browser', browser, 'Browser session connected');
  setCheckDone('mb-check-prompts', prompts, `${mbParsedPrompts.length} prompts parsed and validated`);

  document.getElementById('btn-mb-start-batch').disabled = !(refs && prompts);
}

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ═══════════════════════════════════════════
// Keyboard Shortcuts
// ═══════════════════════════════════════════
const pageShortcuts = ['setup', 'review', 'queue', 'gallery', 'moodboard'];

document.addEventListener('keydown', (e) => {
  // Don't trigger shortcuts when typing in inputs/textareas
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  // ? — Toggle shortcuts overlay
  if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    toggleShortcutsOverlay();
    return;
  }

  // Escape — Close overlays
  if (e.key === 'Escape') {
    closeShortcutsOverlay();
    closeConfirmModal();
    return;
  }

  // Ctrl+1-5 — Navigate pages
  if (e.ctrlKey && e.key >= '1' && e.key <= '5') {
    e.preventDefault();
    const idx = parseInt(e.key) - 1;
    if (pageShortcuts[idx]) showPage(pageShortcuts[idx]);
    return;
  }

  // Space — Pause/Resume batch (only on queue page)
  if (e.key === ' ' && currentPage === 'queue' && !e.ctrlKey) {
    e.preventDefault();
    if (batchRunning) {
      document.getElementById('btn-pause').click();
    } else {
      document.getElementById('btn-resume').click();
    }
    return;
  }
});

function toggleShortcutsOverlay() {
  const overlay = document.getElementById('shortcuts-overlay');
  overlay.classList.toggle('open');
}

function closeShortcutsOverlay() {
  document.getElementById('shortcuts-overlay')?.classList.remove('open');
}

// Close shortcuts overlay when clicking outside the card
document.getElementById('shortcuts-overlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'shortcuts-overlay') closeShortcutsOverlay();
});

// ═══════════════════════════════════════════
// Custom Confirm Modal (replaces browser confirm)
// ═══════════════════════════════════════════
let confirmResolve = null;

function showConfirm(title, message) {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-overlay').classList.add('open');
  });
}

function closeConfirmModal() {
  document.getElementById('confirm-overlay')?.classList.remove('open');
  if (confirmResolve) {
    confirmResolve(false);
    confirmResolve = null;
  }
}

document.getElementById('confirm-ok')?.addEventListener('click', () => {
  document.getElementById('confirm-overlay').classList.remove('open');
  if (confirmResolve) {
    confirmResolve(true);
    confirmResolve = null;
  }
});

document.getElementById('confirm-cancel')?.addEventListener('click', () => {
  closeConfirmModal();
});

document.getElementById('confirm-overlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'confirm-overlay') closeConfirmModal();
});

// Override the cancel button to use custom confirm
(function overrideCancelButton() {
  const cancelBtn = document.getElementById('btn-cancel');
  if (!cancelBtn) return;

  // Remove old listeners by cloning
  const newBtn = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newBtn, cancelBtn);

  newBtn.addEventListener('click', async () => {
    const confirmed = await showConfirm(
      'Cancel Batch',
      'Are you sure you want to cancel the current batch? This will stop all pending generations.'
    );
    if (confirmed) {
      await fetch('/api/batch/cancel', { method: 'POST' });
      batchRunning = false;
      updateQueueControls();
    }
  });
})();

// ═══════════════════════════════════════════
// Batch Elapsed Timer
// ═══════════════════════════════════════════
let batchStartTime = null;
let timerInterval = null;

function startBatchTimer() {
  batchStartTime = Date.now();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(updateTimerDisplay, 1000);
  updateTimerDisplay();
}

function stopBatchTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay() {
  if (!batchStartTime) return;
  const elapsed = Date.now() - batchStartTime;
  const secs = Math.floor(elapsed / 1000) % 60;
  const mins = Math.floor(elapsed / 60000) % 60;
  const hrs = Math.floor(elapsed / 3600000);

  let timeStr = '';
  if (hrs > 0) timeStr = `${hrs}h ${String(mins).padStart(2, '0')}m`;
  else if (mins > 0) timeStr = `${mins}m ${String(secs).padStart(2, '0')}s`;
  else timeStr = `${secs}s`;

  // Update timer display in progress area if it exists
  let timerEl = document.getElementById('batch-timer');
  if (!timerEl) {
    const progressRow = document.querySelector('.progress-top-row');
    if (progressRow) {
      timerEl = document.createElement('span');
      timerEl.id = 'batch-timer';
      timerEl.className = 'batch-timer';
      timerEl.innerHTML = `<svg class="timer-icon" viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><span></span>`;
      progressRow.appendChild(timerEl);
    }
  }
  if (timerEl) {
    const span = timerEl.querySelector('span:last-child');
    if (span) span.textContent = timeStr;
  }
}

// Hook into batch events for timer
const origHandleEvent = handleEvent;
handleEvent = function(event) {
  // Start timer on batch start
  if (event.type === 'batch_started') startBatchTimer();
  // Stop timer on batch complete/cancel
  if (event.type === 'batch_completed' || event.type === 'batch_cancelled') stopBatchTimer();

  // Auto-scroll queue job list when new job starts
  if (event.type === 'job_started') {
    setTimeout(() => {
      const activeRow = document.querySelector('.job-row.active');
      if (activeRow) activeRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 200);
  }

  // Call original handler
  origHandleEvent(event);
};

// ═══════════════════════════════════════════
// Scroll Animations (IntersectionObserver)
// ═══════════════════════════════════════════
function setupScrollAnimations() {
  // Add animate-on-scroll class to panels
  document.querySelectorAll('.panel').forEach((panel, i) => {
    panel.classList.add('animate-on-scroll');
    panel.style.transitionDelay = `${i * 50}ms`;
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
}

// Run after a slight delay to let page render
setTimeout(setupScrollAnimations, 300);

// Re-run scroll animations when page changes
const origShowPage = showPage;
showPage = function(name) {
  origShowPage(name);
  // Re-animate panels on the new page
  setTimeout(() => {
    const activePage = document.querySelector('.page.active');
    if (activePage) {
      activePage.querySelectorAll('.panel').forEach((panel, i) => {
        panel.classList.remove('animate-on-scroll', 'visible');
        // Force reflow
        void panel.offsetWidth;
        panel.classList.add('animate-on-scroll');
        panel.style.transitionDelay = `${i * 60}ms`;
        setTimeout(() => panel.classList.add('visible'), 30);
      });
    }
  }, 50);
};
