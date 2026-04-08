const ExcelJS = require('exceljs');

const INBOUND_HEADERS = [
  'sku',
  'carton_qty',
  'qty_pieces',
  'gross_weight',
  'unit_value',
  'total_value',
  'container_no',
  'admission_no',
  'entry_date',
  'hts_code',
  'port_of_entry',
  'country_of_origin',
  'mid'
];

const OUTBOUND_HEADERS = [
  'customer',
  'po_no',
  'do_no',
  'issue_date',
  'sku',
  'description',
  'qty_shipped',
  'container_no'
];

function normalizeCellValue(cellValue) {
  if (cellValue == null) return null;
  if (cellValue instanceof Date) return cellValue;
  if (typeof cellValue === 'object') {
    if (Object.prototype.hasOwnProperty.call(cellValue, 'result')) {
      return normalizeCellValue(cellValue.result);
    }
    if (Object.prototype.hasOwnProperty.call(cellValue, 'text')) {
      return String(cellValue.text).trim();
    }
    if (Object.prototype.hasOwnProperty.call(cellValue, 'richText')) {
      return cellValue.richText.map((p) => p.text).join('').trim();
    }
  }
  if (typeof cellValue === 'string') return cellValue.trim();
  return cellValue;
}

function validateHeaders(headers, expectedHeaders) {
  const missing = expectedHeaders.filter((h) => !headers.includes(h));
  if (missing.length) {
    throw new Error(`Template mismatch. Missing required columns: ${missing.join(', ')}`);
  }
}

async function parseWorkbook(filePath, options = {}) {
  const profile = options.profile || 'generic';
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows = [];
  const headerRow = sheet.getRow(1);
  const headers = [];
  headerRow.eachCell((cell, colNumber) => {
    headers.push(String(normalizeCellValue(cell.value) || '').trim());
  });

  if (profile === 'inbound') validateHeaders(headers, INBOUND_HEADERS);
  if (profile === 'outbound') validateHeaders(headers, OUTBOUND_HEADERS);

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const obj = {};
    headers.forEach((key, colIndex) => {
      const cell = row.getCell(colIndex + 1);
      obj[key] = normalizeCellValue(cell.value);
    });

    row.eachCell((cell, colNumber) => {
      const key = headers[colNumber - 1] || `col${colNumber}`;
      obj[key] = normalizeCellValue(cell.value);
    });

    // skip empty rows
    const allEmpty = Object.values(obj).every(v => v === null || v === undefined || v === '');
    if (!allEmpty) rows.push(obj);
  });

  return rows;
}

module.exports = { parseWorkbook, INBOUND_HEADERS, OUTBOUND_HEADERS };
