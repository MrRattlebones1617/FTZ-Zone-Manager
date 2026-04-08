const express = require('express');
const ExcelJS = require('exceljs');

const router = express.Router();

router.get('/inbound', async (req, res) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Inbound Template');
  sheet.addRow([
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
  ]);
  // sample row
  sheet.addRow(['SKU123', 10, 100, 240.5, 10.5, 1050, 'CONT-123', 'ADM-0001', new Date().toISOString().slice(0, 10), '0101.10', 'Port A', 'MX', 'MID-001']);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="inbound_template.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
});

router.get('/outbound', async (req, res) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Outbound Template');
  sheet.addRow(['customer', 'po_no', 'do_no', 'issue_date', 'sku', 'description', 'qty_shipped', 'container_no']);
  sheet.addRow(['Customer A', 'PO-001', 'DO-001', new Date().toISOString().slice(0, 10), 'SKU123', 'Sample Item', 10, 'CONT-123']);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="outbound_template.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
});

module.exports = router;
