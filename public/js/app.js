/**
 * Image Batch Studio — Dashboard Application
 * Complete frontend JS with sidebar nav, WebSocket, gallery, lightbox.
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

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupSetup();
  setupReview();
  setupQueue();
  setupGallery();
  setupLightbox();
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
  document.querySelectorAll('.step').forEach((s, i) => {
    s.classList.remove('done', 'current');
    if (i < idx) s.classList.add('done');
    else if (i === idx) s.classList.add('current');
  });
  document.querySelectorAll('.step-line').forEach((l, i) => {
    l.classList.toggle('done', i < idx);
  });

  // Refresh gallery when switching to it
  if (name === 'gallery') loadGallery();
}

function updateContextBar() {
  const el = document.getElementById('ctx-batchname');
  const sub = document.getElementById('ctx-sub');
  if (currentBatchName) {
    el.textContent = currentBatchName;
    const refCount = referenceImages.length;
    const promptCount = parsedPrompts.length;
    sub.textContent = `${promptCount} prompts · ${refCount} references · output → /batches/${currentBatchName}/`;
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

    case 'rate_limit_detected':
      showToast(`Rate limit: ${event.message}`, 'error');
      break;

    case 'captcha_detected':
      showToast('CAPTCHA detected — complete it in the browser', 'warning');
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

  // Load file
  document.getElementById('btn-load-file').addEventListener('click', () => {
    document.getElementById('file-input').click();
  });
  document.getElementById('file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      document.getElementById('prompts-input').value = ev.target.result;
      showToast(`Loaded: ${file.name}`, 'success');
    };
    reader.readAsText(file);
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
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M5 12l5 5L20 7"/></svg>Session ready`;
      updateChecklist();
    } catch (err) {
      showToast(`Browser launch failed: ${err.message}`, 'error');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>Launch browser`;
    }
    btn.disabled = false;
  });

  // Start batch
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
  if (done) {
    el.className = 'check-row done';
    el.innerHTML = `<span class="check-mark"><svg viewBox="0 0 24 24" fill="none" stroke-width="3"><path d="M4 12l5 5L20 6"/></svg></span>${text}`;
  } else {
    el.className = 'check-row';
    el.innerHTML = `<span class="check-mark"></span>${text}`;
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

  // Build image URL from batch path
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
  // Handle both Windows and Unix paths
  if (imagePath.includes('batches\\') || imagePath.includes('batches/')) {
    const relative = imagePath.split(/batches[\\/]/)[1];
    if (relative) return `/batches/${relative.replace(/\\/g, '/')}`;
  }
  if (imagePath.includes('downloaded_images')) {
    const filename = imagePath.split(/[\\/]/).pop();
    return `/downloaded-images/${filename}`;
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

  // Update queue badge
  const badge = document.getElementById('queue-badge');
  if (progress.state === 'running') {
    badge.style.display = '';
    badge.textContent = `${completed}/${total}`;
  }

  // Status pill
  const statusPill = document.getElementById('q-status-pill');
  const state = progress.state || 'setup';
  statusPill.className = 'pill';
  if (state === 'running') { statusPill.className = 'pill accent pulsing'; statusPill.innerHTML = '<span class="dotm"></span>Running'; }
  else if (state === 'paused') { statusPill.className = 'pill warning'; statusPill.innerHTML = '<span class="dotm"></span>Paused'; }
  else if (state === 'completed') { statusPill.className = 'pill success'; statusPill.innerHTML = '<span class="dotm"></span>Complete'; }
  else { statusPill.textContent = state; }

  // Render job list
  renderJobList(progress.jobs || []);

  // Update current job
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

  // Show completed image for the most recent completed job
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
    pillEl.className = 'pill ' + getJobPillClass(state);
    pillEl.innerHTML = getJobPillContent(state);
  }
}

function renderJobList(jobs) {
  const container = document.getElementById('job-list');
  container.innerHTML = jobs.map(job => {
    const isActive = job.state === 'generating';
    const name = job.originalPrompt ? job.originalPrompt.substring(0, 40) : `Prompt ${job.promptIndex}`;
    return `
      <div class="job-row${isActive ? ' active' : ''}" data-job-index="${job.promptIndex}">
        <span class="job-idx">${String(job.promptIndex).padStart(2, '0')}</span>
        <span class="job-name">${esc(name)}</span>
        <span class="pill job-pill ${getJobPillClass(job.state)}">${getJobPillContent(job.state)}</span>
        ${job.state === 'failed' ? `
          <div class="job-actions" style="opacity:1;">
            <button class="btn btn-ghost btn-sm" onclick="retryJob(${job.promptIndex})">Retry</button>
            <button class="btn btn-ghost btn-sm" onclick="skipJob(${job.promptIndex})">Skip</button>
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
    await fetch('/api/batch/retry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptIndex }),
    });
    showToast(`Retrying prompt ${promptIndex}`, 'info');
  } catch (err) {
    showToast(`Retry failed: ${err.message}`, 'error');
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

  if (batches.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        <h3>No batches yet</h3>
        <p>Start a batch from the Setup page to see images here.</p>
      </div>
    `;
    document.getElementById('gallery-stats').textContent = '';
    return;
  }

  let totalImages = 0;
  container.innerHTML = batches.map(batch => {
    const p = batch.progress;
    const completed = p?.completedCount || 0;
    const total = p?.totalPrompts || 0;
    const state = p?.state || 'unknown';
    const jobs = p?.jobs || [];
    const completedJobs = jobs.filter(j => j.state === 'completed' && j.imagePath);
    totalImages += completedJobs.length;

    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const progressColor = state === 'completed' ? 'var(--success)' : state === 'paused' || state === 'cancelled' ? 'var(--warning)' : '';

    return `
      <div class="batch-card" id="batch-${esc(batch.name)}">
        <div class="batch-card-header" onclick="toggleBatch('${esc(batch.name)}')">
          <div class="batch-card-main">
            <div class="batch-name-row">
              <span class="batch-name">${esc(batch.name)}</span>
              <span class="pill ${getStatePillClass(state)}">${getStatePillContent(state)}</span>
            </div>
            <div class="batch-meta">
              <span>${completedJobs.length} images</span>
              <span>${total} prompts</span>
              <span>/batches/${esc(batch.name)}/</span>
            </div>
          </div>
          <div class="batch-progress">
            <div class="progress-bar"><div class="progress-bar-fill" style="width:${pct}%;${progressColor ? ' background:' + progressColor + ';' : ''}"></div></div>
            <div class="batch-progress-label">${completed} / ${total}</div>
          </div>
          <div class="batch-toggle">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
          </div>
        </div>
        <div class="batch-card-images">
          ${completedJobs.length > 0 ? `
            <div class="gallery-grid">
              ${completedJobs.map((job, idx) => {
                const imgUrl = buildImageUrl(job.imagePath);
                return `
                  <div class="gallery-item" onclick="openLightbox('${esc(batch.name)}', ${idx})">
                    <img src="${imgUrl}" alt="Image ${job.promptIndex}" loading="lazy">
                    <div class="gallery-item-label">#${String(job.promptIndex).padStart(2, '0')} ${esc((job.originalPrompt || '').substring(0, 30))}</div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : '<div class="gallery-empty">No images generated yet</div>'}
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('gallery-stats').textContent = `${batches.length} batches · ${totalImages} images`;
}

function getStatePillClass(state) {
  switch (state) {
    case 'completed': return 'success';
    case 'running': return 'accent pulsing';
    case 'paused': case 'cancelled': return 'warning';
    case 'failed': return 'danger';
    default: return '';
  }
}

function getStatePillContent(state) {
  switch (state) {
    case 'completed': return 'Completed';
    case 'running': return '<span class="dotm"></span>Running';
    case 'paused': return 'Paused';
    case 'cancelled': return 'Interrupted';
    case 'failed': return 'Failed';
    default: return state;
  }
}

function toggleBatch(batchName) {
  const card = document.getElementById('batch-' + batchName);
  if (card) card.classList.toggle('expanded');
}

// ═══════════════════════════════════════════
// Lightbox
// ═══════════════════════════════════════════
function setupLightbox() {
  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('lightbox-prev').addEventListener('click', () => navigateLightbox(-1));
  document.getElementById('lightbox-next').addEventListener('click', () => navigateLightbox(1));

  document.getElementById('lightbox').addEventListener('click', (e) => {
    if (e.target.id === 'lightbox' || e.target.classList.contains('lightbox-overlay')) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('lightbox').classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
    if (e.key === 'ArrowRight') navigateLightbox(1);
  });
}

function openLightbox(batchName, imageIndex) {
  // Build images array from batch data
  const batch = galleryBatches.find(b => b.name === batchName);
  if (!batch || !batch.progress) return;

  const completedJobs = (batch.progress.jobs || []).filter(j => j.state === 'completed' && j.imagePath);
  lightboxImages = completedJobs.map(job => ({
    url: buildImageUrl(job.imagePath),
    prompt: job.originalPrompt || '',
    index: job.promptIndex,
  }));

  if (lightboxImages.length === 0) return;

  lightboxIndex = Math.min(imageIndex, lightboxImages.length - 1);
  updateLightboxImage();
  document.getElementById('lightbox').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('active');
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
  document.getElementById('lightbox-info').textContent = `#${String(img.index).padStart(2, '0')} — ${img.prompt}`;
}

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
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
