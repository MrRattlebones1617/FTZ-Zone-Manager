const express = require('express');
const pool = require('../src/db');

const router = express.Router();

router.get('/view', async (req, res) => {
  try {
    const [inboundHistory] = await pool.query(
      `SELECT id, admission_no, container_no, sku, qty_pieces, qty_remaining, entry_date
       FROM inbound_inventory
       ORDER BY entry_date DESC, created_at DESC`
    );

    const [outboundHistory] = await pool.query(
      `SELECT id, customer, do_no, po_no, sku, description, issue_date, container_no, qty_shipped
       FROM outbound_orders
       ORDER BY issue_date DESC, created_at DESC`
    );

    res.renderPage('history', { inboundHistory, outboundHistory });
  } catch (err) {
    console.error('History error:', err.message || err);
    res.status(200).renderPage('history', {
      inboundHistory: [],
      outboundHistory: [],
      message: 'Database connection failed: ' + (err.message || ''),
      messageType: 'error'
    });
  }
});

module.exports = router;
