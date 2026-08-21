/**
 * Content script for IP Portal Automation
 * Listens for parsed Excel data and matches rows by Enrollment Number / Name / S.No,
 * then fills input fields with full React synthetic event dispatching.
 */

// Helper to set values on React / DOM inputs
function setReactInputValue(inputElement, value) {
  if (!inputElement) return;

  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(inputElement, value);
  } else {
    inputElement.value = value;
  }

  // Dispatch events so React/Vue/Angular synthetic event systems catch the change
  inputElement.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  inputElement.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  inputElement.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
}

// Normalizer for flexible matching
function normalize(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim().toLowerCase().replace(/^0+/, '');
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'AUTOFILL_EXCEL_DATA') {
    const excelData = request.data || [];
    if (excelData.length === 0) {
      sendResponse({ success: false, error: 'No data provided' });
      return true;
    }

    // Build lookup maps by enrollment number, student name, and S.No
    const enrollmentMap = new Map();
    const nameMap = new Map();

    excelData.forEach(row => {
      // Look for common enrollment/roll number headers
      const enrollKey = row['Enlorrment Number'] ?? row['Enrollment Number'] ?? row['Enrollment No'] ?? row['Roll No'] ?? row['RollNo'] ?? row['ID'];
      const nameKey = row['Name'] ?? row['Student Name'];
      const marksVal = row['Marks Alloted'] ?? row['Marks'] ?? row['Internal Marks'] ?? row['Marks Allotted'] ?? row['Score'];

      if (enrollKey !== undefined && marksVal !== undefined) {
        enrollmentMap.set(normalize(enrollKey), marksVal);
      }
      if (nameKey !== undefined && marksVal !== undefined) {
        nameMap.set(normalize(nameKey), marksVal);
      }
    });

    let filledCount = 0;

    // Find all table rows
    const rows = document.querySelectorAll('table tbody tr, table tr');

    rows.forEach(row => {
      const rowText = row.innerText || row.textContent || '';
      const inputs = row.querySelectorAll('input');
      if (inputs.length === 0) return;

      // Check if any cell matches enrollment number or name
      const cells = row.querySelectorAll('td, th');
      let matchedMarks = null;

      for (const cell of cells) {
        const cellText = normalize(cell.innerText || cell.textContent || '');
        if (enrollmentMap.has(cellText)) {
          matchedMarks = enrollmentMap.get(cellText);
          break;
        }
        if (nameMap.has(cellText)) {
          matchedMarks = nameMap.get(cellText);
          break;
        }
      }

      // If matched, fill the marks input in this row
      if (matchedMarks !== null && matchedMarks !== undefined) {
        // Target number or text input in row
        const targetInput = row.querySelector('input[type="number"]');
        if (targetInput && targetInput.value != matchedMarks  ) {
          if(isNaN(Number(matchedMarks))){
            matchedMarks = 0;
          }
          setReactInputValue(targetInput, matchedMarks);
          targetInput.style.backgroundColor = '#dcfce7'; // subtle green highlight
          targetInput.style.transition = 'background-color 0.5s ease';
          filledCount++;
        }
      }
    });

    sendResponse({
      success: true,
      filledCount: filledCount,
      totalExcelRows: excelData.length
    });
  }
  return true;
});
