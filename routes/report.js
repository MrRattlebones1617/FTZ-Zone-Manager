const express = require('express');
const ExcelJS = require('exceljs');
const pool = require('../src/db');

const router = express.Router();

function styleHeaderRow(sheet, rowNumber) {
  const row = sheet.getRow(rowNumber);
  row.font = { bold: true };
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' }
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });
}

function styleDataRow(sheet, rowNumber) {
  const row = sheet.getRow(rowNumber);
  row.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
}

function safeSheetName(base, index) {
  const cleaned = String(base || 'DO').replace(/[\\/?*\[\]:]/g, '_').slice(0, 24);
  return `${cleaned}_${index}`.slice(0, 31);
}

function toNumericIds(values) {
  if (!values) return [];
  const arr = Array.isArray(values) ? values : [values];
  return arr
    .flatMap((v) => String(v).split(','))
    .map((v) => Number(String(v).trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

async function fetchReportRows(filters) {
  const { doNoFilter = '', poNoFilter = '', outboundIds = [] } = filters;
  const whereClause = [];
  const params = [];

  if (doNoFilter) {
    whereClause.push('oo.do_no = ?');
    params.push(doNoFilter);
  }
  if (poNoFilter) {
    whereClause.push('oo.po_no = ?');
    params.push(poNoFilter);
  }
  if (outboundIds.length) {
    whereClause.push(`oo.id IN (${outboundIds.map(() => '?').join(',')})`);
    params.push(...outboundIds);
  }

  const [rows] = await pool.query(
    `SELECT rl.id,
            rl.qty_matched,
            oo.id AS outbound_id,
            oo.do_no,
            oo.po_no,
            oo.issue_date,
            oo.sku,
            oo.description,
            ii.entry_date,
            ii.admission_no,
            ii.hts_code,
            ii.mid,
            ii.country_of_origin,
            ii.unit_value
     FROM reconciliation_log rl
     INNER JOIN outbound_orders oo ON oo.id = rl.outbound_order_id
     INNER JOIN inbound_inventory ii ON ii.id = rl.inbound_inventory_id
     ${whereClause.length ? `WHERE ${whereClause.join(' AND ')}` : ''}
     ORDER BY oo.do_no ASC, oo.issue_date ASC, oo.id ASC, ii.entry_date ASC, ii.id ASC, rl.id ASC`,
    params
  );

  return rows;
}

function renderReportSheet(workbook, sheetName, rows) {
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = [
    { key: 'transfer_date', width: 14 },
    { key: 'item_number', width: 18 },
    { key: 'description', width: 34 },
    { key: 'zone_status', width: 12 },
    { key: 'pf_date', width: 14 },
    { key: 'admission_no', width: 18 },
    { key: 'htsus', width: 14 },
    { key: 'mid', width: 16 },
    { key: 'coo', width: 10 },
    { key: 'quantity', width: 12 },
    { key: 'unit_cost', width: 12 },
    { key: 'total_value', width: 14 }
  ];

  const doNos = [...new Set(rows.map((r) => r.do_no).filter(Boolean))];
  const poNos = [...new Set(rows.map((r) => r.po_no).filter(Boolean))];
  const doText = doNos.length === 1 ? doNos[0] : 'MULTIPLE';
  const poText = poNos.length === 1 ? poNos[0] : 'MULTIPLE';

  sheet.mergeCells('A1:L1');
  sheet.getCell('A1').value = 'Zone-to-Zone Transfer Report';
  sheet.getCell('A1').font = { bold: true, size: 16 };
  sheet.getCell('A1').alignment = { horizontal: 'center' };

  sheet.mergeCells('A2:L2');
  sheet.getCell('A2').value = 'Ingram Micro Inc LATAM';
  sheet.getCell('A2').font = { bold: true, size: 12 };
  sheet.getCell('A2').alignment = { horizontal: 'center' };

  sheet.mergeCells('A3:L3');
  sheet.getCell('A3').value = `Shipment Number: DO # ${doText} / PO# ${poText}`;
  sheet.getCell('A3').font = { bold: true, size: 11 };
  sheet.getCell('A3').alignment = { horizontal: 'center' };

  sheet.addRow([]);

  const headerRowNumber = 5;
  sheet.getRow(headerRowNumber).values = [
    'Transfer Date',
    'Item Number',
    'Description',
    'Zone Status',
    'PF Date',
    'Admission No.',
    'HTSUS',
    'MID',
    'CoO',
    'Quantity',
    'Unit Cost',
    'Total Value'
  ];
  styleHeaderRow(sheet, headerRowNumber);

  let currentRow = headerRowNumber + 1;
  for (const r of rows) {
    const quantity = Number(r.qty_matched || 0);
    const unitCost = Number(r.unit_value || 0);
    const totalValue = quantity * unitCost;

    sheet.getRow(currentRow).values = [
      r.issue_date ? new Date(r.issue_date) : null,
      r.sku,
      r.description || '',
      'PF',
      r.entry_date ? new Date(r.entry_date) : null,
      r.admission_no || '',
      r.hts_code || '',
      r.mid || '',
      r.country_of_origin || '',
      quantity,
      unitCost,
      totalValue
    ];
    styleDataRow(sheet, currentRow);
    sheet.getCell(`A${currentRow}`).numFmt = 'yyyy-mm-dd';
    sheet.getCell(`E${currentRow}`).numFmt = 'yyyy-mm-dd';
    sheet.getCell(`J${currentRow}`).numFmt = '#,##0.0000';
    sheet.getCell(`K${currentRow}`).numFmt = '$#,##0.0000';
    sheet.getCell(`L${currentRow}`).numFmt = '$#,##0.00';
    currentRow += 1;
  }

  const certificationRow = currentRow + 2;
  sheet.mergeCells(`A${certificationRow}:L${certificationRow + 2}`);
  sheet.getCell(`A${certificationRow}`).value =
    `As operator of the transferring zone, I certify that this documentation, covering trailer/BOL number ${doText}, ` +
    `accurately reflects the merchandise transferred zone-to-zone, including quantity, value, and admission references, ` +
    `and that all entries are true and correct to the best of my knowledge and belief in accordance with 19 CFR requirements.\n\n` +
    'Authorized Signature: ____________________________    Printed Name/Title: ____________________________    Date: __________________';
  sheet.getCell(`A${certificationRow}`).alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
  sheet.getCell(`A${certificationRow}`).font = { size: 10 };

  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.4,
      right: 0.4,
      top: 0.6,
      bottom: 0.6,
      header: 0.3,
      footer: 0.3
    }
  };

  sheet.views = [{ state: 'frozen', ySplit: headerRowNumber }];

  return { doText, poText };
}

async function buildZoneToZoneReport(req, res) {
  try {
    const doNoFilter = (req.query.do_no || req.body?.do_no || '').trim();
    const poNoFilter = (req.query.po_no || req.body?.po_no || '').trim();
    const outboundIds = [
      ...toNumericIds(req.query.outbound_ids),
      ...toNumericIds(req.body?.outbound_ids)
    ];

    const rows = await fetchReportRows({ doNoFilter, poNoFilter, outboundIds: [...new Set(outboundIds)] });

    if (!rows.length) {
      return res.status(404).json({ error: 'No matched Zone-to-Zone records found for the selected criteria.' });
    }

    const workbook = new ExcelJS.Workbook();

    const groupedByDo = new Map();
    for (const row of rows) {
      const key = row.do_no || `DO_${row.outbound_id}`;
      if (!groupedByDo.has(key)) groupedByDo.set(key, []);
      groupedByDo.get(key).push(row);
    }

    const groups = [...groupedByDo.entries()];
    let firstMeta = { doText: 'MULTIPLE', poText: 'MULTIPLE' };

    groups.forEach(([doNo, doRows], index) => {
      const sheetName = groups.length === 1 ? 'Zone-to-Zone Report' : safeSheetName(`DO_${doNo}`, index + 1);
      const meta = renderReportSheet(workbook, sheetName, doRows);
      if (index === 0) firstMeta = meta;
    });

    const fileDoNo = (groups.length === 1 ? firstMeta.doText : 'MULTIPLE').replace(/[^A-Za-z0-9_-]/g, '_');
    const filePoNo = (groups.length === 1 ? firstMeta.poText : 'MULTIPLE').replace(/[^A-Za-z0-9_-]/g, '_');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="zone_to_zone_DO_${fileDoNo}_PO_${filePoNo}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

router.get('/export', buildZoneToZoneReport);
router.get('/cbp-export', buildZoneToZoneReport);
router.get('/ztz-export', buildZoneToZoneReport);
router.post('/ztz-export', buildZoneToZoneReport);

module.exports = router;
