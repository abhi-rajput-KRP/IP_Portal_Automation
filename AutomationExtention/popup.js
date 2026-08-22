document.addEventListener('DOMContentLoaded', async () => {
  const body = document.querySelector("body");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    body.innerHTML = `<div>No tab open</div>`;
  }
  else if (!tab.url || !tab.url.startsWith('https://ip-portal-automation.vercel.app/students')) {
    body.innerHTML = `<div>Please open https://ip-portal-automation.vercel.app/students</div>`;
  }
  const fileInput = document.getElementById('excel-file-input');
  const dropZone = document.getElementById('drop-zone');
  const fileInfo = document.getElementById('file-info');
  const fileNameEl = document.getElementById('file-name');
  const fileMetaEl = document.getElementById('file-meta');
  const btnFill = document.getElementById('btn-fill');
  const statusMsg = document.getElementById('status-msg');

  //  CHANGE THIS every time your Codespaces URL changes (e.g. after a restart)
  const BACKEND_URL = 'http://127.0.0.1:8000';
  const PORTAL_URL_PREFIX = 'https://ip-portal-automation.vercel.app/students';

  let parsedData = [];
  let currentThreadId = null;

  // ---------- Drag and drop visual handling ----------
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  // ---------- Parse the uploaded Excel/CSV file ----------
  async function handleFile(file) {
    try {
      showStatus('', '');
      fileNameEl.textContent = file.name;

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      // defval: '' ensures every row has every column key, even if the cell is empty
      parsedData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      fileMetaEl.textContent = `${parsedData.length} records found in "${firstSheetName}"`;
      fileInfo.style.display = 'block';
      btnFill.disabled = false;
      btnFill.innerHTML = `<span>⚡</span> Fill Records`;
      btnFill.onclick = runWorkflow; // make sure click always points to the first-stage function
    } catch (err) {
      console.error('Error parsing file:', err);
      showStatus('Failed to read Excel/CSV file', 'error');
    }
  }

  // ---------- Stage 1: match + fill (talks to backend) ----------
  async function runWorkflow() {
    if (parsedData.length === 0) return;

    btnFill.disabled = true;
    btnFill.textContent = 'Matching...';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // 1. Ask content.js to scrape the live portal table
      const scrapeResp = await sendMessageToTab(tab.id, { action: 'SCRAPE_PORTAL_TABLE' });
      const portalStudents = (scrapeResp && scrapeResp.students) || [];

      // 2. Send parsed Excel rows + portal students to the Python backend
      const response = await fetch(`${BACKEND_URL}/api/run-workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_type: 'excel',
          records: parsedData,
          portal_students: portalStudents,
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend returned status ${response.status}`);
      }

      const result = await response.json();
      currentThreadId = result.thread_id;

      // 3. Send field_instructions to content.js to actually fill/annotate the DOM
      const fillResp = await sendMessageToTab(tab.id, {
        action: 'APPLY_FIELD_INSTRUCTIONS',
        data: result.field_instructions,
      });

      showStatus(
        `✓ ${fillResp.filledCount}/${fillResp.total} filled — ${result.summary_text || ''}`,
        'success'
      );

      // switch the button into "stage 2" mode
      btnFill.disabled = false;
      btnFill.textContent = 'Create Final Logs';
      btnFill.onclick = () => confirmAndSubmit(tab.id);

    } catch (err) {
      console.error(err);
      showStatus('Error running workflow: ' + err.message, 'error');
      btnFill.disabled = false;
      btnFill.innerHTML = `<span>⚡</span> Fill Records`;
      btnFill.onclick = runWorkflow;
    }
  }

  // ---------- Stage 2: rescan + resume + submit ----------
  async function confirmAndSubmit(tabId) {
    btnFill.disabled = true;
    btnFill.textContent = 'Logging...';

    try {
      const rescanResp = await sendMessageToTab(tabId, { action: 'RESCAN_FIELDS' });

      const response = await fetch(`${BACKEND_URL}/api/resume-workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread_id: currentThreadId,
          final_field_values: rescanResp.values,
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend returned status ${response.status}`);
      }

      const result = await response.json();
      showStatus(result.summary_text || 'Submitted successfully', 'success');

      btnFill.textContent = 'Done';
      btnFill.disabled = true;

    } catch (err) {
      console.error(err);
      showStatus('Error submitting: ' + err.message, 'error');
      btnFill.disabled = false;
      btnFill.textContent = 'Review & Submit';
    }
  }

  // ---------- Helper: promise wrapper around chrome.tabs.sendMessage ----------
  function sendMessageToTab(tabId, message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  // ---------- Helper: show/hide status message ----------
  function showStatus(text, type) {
    if (!text) {
      statusMsg.style.display = 'none';
      return;
    }
    statusMsg.className = `status-msg ${type}`;
    statusMsg.textContent = text;
    statusMsg.style.display = 'block';
  }
});