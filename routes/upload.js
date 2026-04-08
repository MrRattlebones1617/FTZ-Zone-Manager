const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parseWorkbook } = require('../src/services/excelParser');
const matchingEngine = require('../src/services/matchingEngine');
const pool = require('../src/db');

const router = express.Router();

function respondUpload(req, res, ok, payload, redirectPath = '/') {
  const acceptsJson = (req.headers.accept || '').includes('application/json');
  if (acceptsJson) {
    return ok ? res.json(payload) : res.status(500).json(payload);
  }
  if (ok) {
    return res.redirect(`${redirectPath}?status=ok&msg=${encodeURIComponent(payload.message || 'Upload processed successfully')}`);
  }
  return res.redirect(`${redirectPath}?status=err&msg=${encodeURIComponent(payload.error || 'Upload failed')}`);
}

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

router.post('/inbound', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('No file uploaded');
    const rows = await parseWorkbook(req.file.path, { profile: 'inbound' });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const r of rows) {
        const sku = String(r.sku || '').trim();
        const carton_qty = Number(r.carton_qty || 0);
        const qty_pieces = Number(r.qty_pieces || 0);
        const qty_remaining = qty_pieces;
        const gross_weight = Number(r.gross_weight || 0);
        const unit_value = Number(r.unit_value || 0);
        const total_value = Number(r.total_value || 0);
        const container_no = String(r.container_no || '').trim();
        const admission_no = String(r.admission_no || '').trim();
        const entry_date = r.entry_date || null;
        const hts_code = String(r.hts_code || '').trim();
        const port_of_entry = String(r.port_of_entry || '').trim();
        const country_of_origin = String(r.country_of_origin || '').trim();
        const mid = String(r.mid || '').trim();

        if (!sku) continue;

        await conn.query(
          'INSERT INTO inbound_inventory (sku, carton_qty, qty_pieces, qty_remaining, gross_weight, unit_value, total_value, container_no, admission_no, entry_date, hts_code, port_of_entry, country_of_origin, mid) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [sku, carton_qty, qty_pieces, qty_remaining, gross_weight, unit_value, total_value, container_no, admission_no, entry_date ? new Date(entry_date) : null, hts_code, port_of_entry, country_of_origin, mid]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    return respondUpload(req, res, true, { ok: true, rows: rows.length, message: `Inbound file processed: ${rows.length} rows` });
  } catch (err) {
    console.error(err);
    return respondUpload(req, res, false, { error: err.message });
  }
});

router.post('/outbound', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('No file uploaded');
    const rows = await parseWorkbook(req.file.path, { profile: 'outbound' });

    const entries = rows.map((r) => ({
      customer: String(r.customer || '').trim(),
      po_no: String(r.po_no || '').trim(),
      do_no: String(r.do_no || '').trim(),
      issue_date: r.issue_date || null,
      sku: String(r.sku || '').trim(),
      description: String(r.description || '').trim(),
      qty_shipped: Number(r.qty_shipped || 0),
      container_no: String(r.container_no || '').trim()
    }));

    await matchingEngine.processOutboundEntries(entries);
    return respondUpload(req, res, true, { ok: true, rows: entries.length, message: `Outbound file processed: ${entries.length} rows` });
  } catch (err) {
    console.error(err);
    return respondUpload(req, res, false, { error: err.message });
  }
});

module.exports = router;
