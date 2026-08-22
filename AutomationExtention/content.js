// content.js

const BACKEND_URL ="http://127.0.0.1:8000";

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

    // ALWAYS assign our own safe, predictable id — don't trust/reuse the portal's existing one
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
function rescanFieldValues() {
  const filled = document.querySelectorAll('[data-agent-status]');
  return Array.from(filled).map(el => ({
    enrolment_no: el.dataset.agentEnrolmentNo,
    field_selector: `#${el.id}`,
    value: el.value,
  }));
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

  if (request.action === 'RESCAN_FIELDS') {
    sendResponse({ values: rescanFieldValues() });
    return true;
  }
});