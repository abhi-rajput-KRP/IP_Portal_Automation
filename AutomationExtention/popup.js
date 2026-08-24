document.addEventListener('DOMContentLoaded', async () => {
  const body = document.querySelector("body");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.id) {
    body.innerHTML = `<div>No tab open</div>`;
    return;
  }
  if (!tab.url || !tab.url.startsWith('https://ip-portal-automation.vercel.app/students')) {
    body.innerHTML = `<div>Please open https://ip-portal-automation.vercel.app/students</div>`;
    return;
  }

  const weightageToggle = document.getElementById('weightage-toggle');
  const weightageCheckbox = document.getElementById('use-weightage-checkbox');
  const weightageForm = document.getElementById('weightage-form');
  const componentsContainer = document.getElementById('components-container');
  const btnAddComponent = document.getElementById('btn-add-component');
  
  let detectedColumns = [];

  weightageCheckbox.addEventListener('change', (e) => {
    weightageForm.style.display = e.target.checked ? 'block' : 'none';
    if (e.target.checked && componentsContainer.children.length === 0) {
      addComponentRow();
      addComponentRow();
    }
  });

  btnAddComponent.addEventListener('click', addComponentRow);

  function addComponentRow() {
    const row = document.createElement('div');
    row.className = 'component-row';

    let colInputHtml;
    if (detectedColumns.length > 0) {
      const options = detectedColumns.map(c => `<option value="${c}">${c}</option>`).join('');
      colInputHtml = `<select class="col-name">${options}</select>`;
    } else {
      colInputHtml = `<input type="text" placeholder="Column name" class="col-name" />`;
    }

    row.innerHTML = `
      ${colInputHtml}
      <input type="number" placeholder="Max" class="col-max" style="max-width:50px;" />
      <input type="number" placeholder="Wt %" class="col-weight" style="max-width:55px;" />
    `;
    componentsContainer.appendChild(row);
  }

  function collectWeightageConfig() {
    if (!weightageCheckbox.checked) return null;

    const rows = document.querySelectorAll('.component-row');
    const config = Array.from(rows).map(row => ({
      column_name: row.querySelector('.col-name').value.trim(),
      max_marks: parseFloat(row.querySelector('.col-max').value),
      weightage: parseFloat(row.querySelector('.col-weight').value) / 100,
    }));

    if (config.some(c => !c.column_name || !c.max_marks)) {
      showStatus('Please fill in every component row', 'error');
      return undefined;
    }
    return config;
  }

  const fileInput = document.getElementById('file-input');
  const dropZone = document.getElementById('drop-zone');
  const fileInfo = document.getElementById('file-info');
  const fileNameEl = document.getElementById('file-name');
  const fileMetaEl = document.getElementById('file-meta');
  const btnFill = document.getElementById('btn-fill');
  const statusMsg = document.getElementById('status-msg');

  const BACKEND_URL = 'https://ip-portal-automation.onrender.com'; //'https://scaling-pancake-jjwq499w4v6j2q79g-8000.app.github.dev';
  const PORTAL_URL_PREFIX = 'https://ip-portal-automation.vercel.app/students';


  let parsedData = [];       // used for excel/csv path
  let selectedImageFile = null; // used for image path
  let currentInputType = null;  // 'excel' | 'image'
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

  // ---------- Detect file type and route to the right handler ----------
  async function handleFile(file) {
    const name = file.name.toLowerCase();
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv');
    const isImage = file.type.startsWith('image/');

    if (isExcel) {
      await handleExcelFile(file);
    } else if (isImage) {
      handleImageFile(file);
    } else {
      showStatus('Unsupported file type. Upload Excel, CSV, or an image.', 'error');
    }
  }

  // ---------- Parse Excel/CSV client-side ----------
  async function handleExcelFile(file) {
    try {
      showStatus('', '');
      currentInputType = 'excel';
      fileNameEl.textContent = file.name;

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      parsedData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      fileMetaEl.textContent = `${parsedData.length} records found in "${firstSheetName}"`;
      fileInfo.style.display = 'block';
      //-------
      detectedColumns = parsedData.length > 0 ? Object.keys(parsedData[0]) : [];
      weightageToggle.style.display = 'block';
      //------
      btnFill.disabled = false;
      btnFill.innerHTML = `<span>⚡</span> Fill Records`;
      btnFill.onclick = runWorkflow;
    } catch (err) {
      console.error('Error parsing file:', err);
      showStatus('Failed to read Excel/CSV file', 'error');
    }
  }

  // ---------- Register image file, no client-side parsing needed ----------
  function handleImageFile(file) {
    showStatus('', '');
    currentInputType = 'image';
    selectedImageFile = file;
    fileNameEl.textContent = file.name;
    fileMetaEl.textContent = 'Scanned mark sheet ready to process';
    fileInfo.style.display = 'block';
    //-------
    weightageToggle.style.display = 'none';
    weightageForm.style.display = 'none';
    weightageCheckbox.checked = false;
    //-------
    btnFill.disabled = false;
    btnFill.innerHTML = `<span>⚡</span> Fill Records`;
    btnFill.onclick = runWorkflow;
  }

  // ---------- Stage 1: match + fill (talks to backend) ----------
  async function runWorkflow() {
    if (currentInputType === 'excel' && parsedData.length === 0) return;
    if (currentInputType === 'image' && !selectedImageFile) return;
    if (!currentInputType) return;

    const weightageConfig = collectWeightageConfig();
    if (weightageConfig === undefined) return; 

    btnFill.disabled = true;
    btnFill.textContent = 'Matching...';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // 1. Ask content.js to scrape the live portal table
      const scrapeResp = await sendMessageToTab(tab.id, { action: 'SCRAPE_PORTAL_TABLE' });
      const portalStudents = (scrapeResp && scrapeResp.students) || [];

      // 2. Build request based on input type
      const formData = new FormData();
      formData.append('input_type', currentInputType);
      formData.append('portal_students', JSON.stringify(portalStudents));
      //-----------
      if (weightageConfig) {
        formData.append('weightage_config', JSON.stringify(weightageConfig));
      }
      //-----------
      if (currentInputType === 'excel') {
        formData.append('records', JSON.stringify(parsedData));
      } else {
        formData.append('image', selectedImageFile);
      }

      const response = await fetch(`${BACKEND_URL}/api/run-workflow`, {
        method: 'POST',
        body: formData, // no Content-Type header — browser sets multipart boundary automatically
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
      await sendMessageToTab(tab.id, { action: 'INJECT_BUTTON', data: currentThreadId });
      btnFill.innerText = "Done";

    } catch (err) {
      console.error(err);
      showStatus('Error running workflow: ' + err.message, 'error');
      btnFill.disabled = false;
      btnFill.innerHTML = `<span>⚡</span> Fill Records`;
      btnFill.onclick = runWorkflow;
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