const express = require('express');
const pool = require('../src/db');

const router = express.Router();

router.put('/inbound/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid inbound id' });

    const sku = String(req.body.sku || '').trim();
    const hts_code = String(req.body.hts_code || '').trim();
    const admission_no = String(req.body.admission_no || '').trim();
    const unit_value = Number(req.body.unit_value || 0);

    if (!sku) return res.status(400).json({ error: 'SKU is required' });

    const [result] = await pool.query(
      'UPDATE inbound_inventory SET sku = ?, hts_code = ?, unit_value = ?, admission_no = ? WHERE id = ?',
      [sku, hts_code, unit_value, admission_no, id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: 'Inbound record not found' });

    const [rows] = await pool.query(
      'SELECT id, sku, hts_code, unit_value, admission_no FROM inbound_inventory WHERE id = ?',
      [id]
    );

    return res.json({ ok: true, record: rows[0] });
  } catch (err) {
    console.error('PUT /api/inbound/:id failed:', err.message || err);
    return res.status(500).json({ error: 'Failed to update inbound record' });
  }
});

router.delete('/inbound/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid inbound id' });

    const forceDelete = String(req.query.force || '0') === '1';

    const [matchRows] = await pool.query(
      'SELECT COUNT(*) AS match_count FROM reconciliation_log WHERE inbound_inventory_id = ?',
      [id]
    );
    const matchCount = Number(matchRows[0]?.match_count || 0);

    if (matchCount > 0 && !forceDelete) {
      return res.status(409).json({
        error: 'Inbound record has matched outbound allocations.',
        warning: true,
        match_count: matchCount,
        message: `This inbound row is linked to ${matchCount} match record(s). Delete again with force=1 to confirm.`
      });
    }

    const [result] = await pool.query('DELETE FROM inbound_inventory WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Inbound record not found' });

    return res.json({ ok: true, deletedId: id, match_count: matchCount });
  } catch (err) {
    console.error('DELETE /api/inbound/:id failed:', err.message || err);
    return res.status(500).json({ error: 'Failed to delete inbound record' });
  }
});

router.put('/outbound/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid outbound id' });

    const do_no = String(req.body.do_no || '').trim();
    const po_no = String(req.body.po_no || '').trim();
    const qty_shipped = Number(req.body.qty_shipped || 0);

    if (!do_no) return res.status(400).json({ error: 'DO# is required' });
    if (!po_no) return res.status(400).json({ error: 'PO# is required' });
    if (qty_shipped <= 0) return res.status(400).json({ error: 'Quantity must be greater than zero' });

    const [result] = await pool.query(
      'UPDATE outbound_orders SET do_no = ?, po_no = ?, qty_shipped = ? WHERE id = ?',
      [do_no, po_no, qty_shipped, id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: 'Outbound record not found' });

    const [rows] = await pool.query(
      'SELECT id, do_no, po_no, qty_shipped FROM outbound_orders WHERE id = ?',
      [id]
    );

    return res.json({ ok: true, record: rows[0] });
  } catch (err) {
    console.error('PUT /api/outbound/:id failed:', err.message || err);
    return res.status(500).json({ error: 'Failed to update outbound record' });
  }
});

router.delete('/outbound/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid outbound id' });

    const [result] = await pool.query('DELETE FROM outbound_orders WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Outbound record not found' });

    return res.json({ ok: true, deletedId: id });
  } catch (err) {
    console.error('DELETE /api/outbound/:id failed:', err.message || err);
    return res.status(500).json({ error: 'Failed to delete outbound record' });
  }
});

module.exports = router;