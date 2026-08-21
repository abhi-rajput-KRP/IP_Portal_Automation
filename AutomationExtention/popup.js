document.addEventListener('DOMContentLoaded', async () => {
  const body = document.querySelector("body");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    body.innerHTML = `<div>No tab open</div>`;
  }
  else if (!tab.url || !tab.url.startsWith('https://ip-portal-automation.vercel.app/students')) {
    body.innerHTML = `<div>Please open https://ip-portal-automation.vercel.app/students'</div>`;
  }
  const fileInput = document.getElementById('excel-file-input');
  const dropZone = document.getElementById('drop-zone');
  const fileInfo = document.getElementById('file-info');
  const fileNameEl = document.getElementById('file-name');
  const fileMetaEl = document.getElementById('file-meta');
  const btnFill = document.getElementById('btn-fill');
  const statusMsg = document.getElementById('status-msg');

  let parsedData = [];

  // Drag and drop styles
  ['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
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

  async function handleFile(file) {
    try {
      showStatus('', '');
      fileNameEl.textContent = file.name;

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      parsedData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      fileMetaEl.textContent = `${parsedData.length} records found in "${firstSheetName}"`;
      fileInfo.style.display = 'block';
      btnFill.disabled = false;
      btnFill.innerHTML = `<span>⚡</span> Fill Records`;
    } catch (err) {
      console.error('Error parsing file:', err);
      showStatus('Failed to read Excel/CSV file', 'error');
    }
  }

  btnFill.addEventListener('click', async () => {
    if (parsedData.length === 0) return;

    btnFill.disabled = true;
    btnFill.textContent = 'Filling...';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      chrome.tabs.sendMessage(tab.id, {
        action: 'AUTOFILL_EXCEL_DATA',
        data: parsedData
      }, (response) => {
        btnFill.disabled = false;
        btnFill.innerHTML = `<span>⚡</span> Fill Records`;

        if (chrome.runtime.lastError) {
          showStatus('Could not communicate with tab. Please refresh the portal page.', 'error');
          return;
        }

        if (response && response.success) {
          showStatus(`✓ Filled ${response.filledCount} student records!`, 'success');
        } else {
          showStatus(response?.error || 'Completed with warnings', 'error');
        }
      });
    } catch (err) {
      console.error(err);
      btnFill.disabled = false;
      showStatus('Error triggering autofill', 'error');
    }
  });

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
