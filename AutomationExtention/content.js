// content.js
function setReactInputValue(inputElement, value) {
  if (!inputElement) return;
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  )?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(inputElement, value);
  } else {
    inputElement.value = value;
  }
  inputElement.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  inputElement.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  inputElement.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
}

function normalize(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim().toLowerCase().replace(/^0+/, '');
}


function getColumnIndices() {
  const headerCells = document.querySelectorAll('table thead th, table tr:first-child th');
  const indices = {};

  headerCells.forEach((th, idx) => {
    const text = th.innerText.trim().toLowerCase();
    if (text.includes('enrol') || text.includes('enlorr') || text.includes('roll')) {
      indices.enrolment_no = idx;
    }
    if (text === 'name') indices.name = idx;
  });

  return indices;
}

function scrapePortalStudents() {
  const students = [];
  const rows = document.querySelectorAll('table tbody tr, table tr');

  rows.forEach((row, idx) => {
    const cells = row.querySelectorAll('td, th');
    const input = row.querySelector('input[type="number"]');
    if (!input) return;

    const enrolment_no = cells[2] ? cells[2].innerText.trim() : '';
    const name = cells[3] ? cells[3].innerText.trim() : '';
    if (!enrolment_no) return;

    input.id = `agent-field-${idx}`;

    students.push({ enrolment_no, name, field_selector: `#${input.id}` });
  });

  return students;
}


// --- Fill + annotate based on backend's field_instructions ---
function applyFieldInstructions(instructions) {
  let filledCount = 0;
  instructions.forEach(instr => {
    const el = document.querySelector(instr.field_selector);
    if (!el) return;

    if (instr.value !== null && instr.value !== undefined) {
      setReactInputValue(el, instr.value);
      filledCount++;
    }
    el.style.background = `${instr.bg_color || '#ffff'}`;
    el.title = instr.reason || '';
    el.dataset.agentStatus = instr.status || '';
    el.dataset.agentEnrolmentNo = instr.enrolment_no || '';
  });
  return filledCount;
}

// --- Rescan current field values before final submit ---

async function injectButton(threadid) {
  const targetParentElement = document.body;
  if (document.getElementById('my-extension-btn')) return;

  const button = document.createElement('button');
  button.id = 'my-extension-btn';
  button.innerText = 'Create Audit Logs';

  button.style.background = "linear-gradient(135deg, #6366f1, #4f46e5)";
  button.style.color = '#ffffff';
  button.style.padding = '10px 10px';
  button.style.border = 'none';
  button.style.position = 'fixed';
  button.style.right = '20px';
  button.style.bottom = '20px';
  button.style.borderRadius = '5px';
  button.style.cursor = 'pointer';
  button.style.zIndex = '9999';

  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Logging...';
    try {
      const filled = document.querySelectorAll('[data-agent-status]');
      const rescanResp = Array.from(filled).map(el => ({
        enrolment_no: el.dataset.agentEnrolmentNo,
        field_selector: `#${el.id}`,
        value: el.value,
      }));
      const BACKEND_URL = 'http://127.0.0.1:8000';
      const response = await fetch(`${BACKEND_URL}/api/resume-workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread_id: threadid,
          final_field_values: rescanResp,
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend returned status ${response.status}`);
      }

      const result = await response.json();
      alert(result.summary_text || 'Submitted successfully', 'success');

      button.disabled = true;
      button.textContent = 'Done';
      button.style.background = "grey";

    } catch (err) {
      console.error(err);
      alert('Error submitting: ' + err.message, 'error');
      button.disabled = false;
      button.textContent = 'Create Audit Logs';
    }
  });

  // 5. Inject the button into the target element
  targetParentElement.appendChild(button);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'SCRAPE_PORTAL_TABLE') {
    sendResponse({ students: scrapePortalStudents() });
    return true;
  }

  if (request.action === 'APPLY_FIELD_INSTRUCTIONS') {
    const filledCount = applyFieldInstructions(request.data || []);
    sendResponse({ success: true, filledCount, total: request.data.length });
    return true;
  }

  // if (request.action === 'RESCAN_FIELDS') {
  //   sendResponse({ values: rescanFieldValues() });
  //   return true;
  // }

  if (request.action === 'INJECT_BUTTON') {
    injectButton(request.data);
    sendResponse({ success: true });
    return true;
  }
});