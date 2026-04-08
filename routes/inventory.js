const express = require('express');
const pool = require('../src/db');

const router = express.Router();

router.get('/view', async (req, res) => {
  try {
    const [summaryRows] = await pool.query(
      `SELECT
         (SELECT COUNT(DISTINCT container_no)
            FROM inbound_inventory
           WHERE container_no IS NOT NULL AND container_no <> '') AS total_containers_in,
         (SELECT COUNT(*) FROM outbound_orders) AS total_dos_out,
         (SELECT COUNT(DISTINCT sku)
            FROM inbound_inventory
           WHERE qty_remaining > 0) AS total_skus_in_zone`
    );

    // Joined balance view: inbound + reconciliation + outbound linkage
    const [live] = await pool.query(
      `SELECT ii.id,
              ii.admission_no,
              ii.sku,
              ii.container_no,
              ii.hts_code,
              ii.unit_value,
              ii.qty_pieces,
              ii.qty_remaining,
              ii.entry_date,
              COALESCE(SUM(rl.qty_matched), 0) AS qty_depleted,
              GROUP_CONCAT(DISTINCT io.do_no ORDER BY io.issue_date SEPARATOR ', ') AS linked_do_numbers
       FROM inbound_inventory ii
       LEFT JOIN reconciliation_log rl ON ii.id = rl.inbound_inventory_id
       LEFT JOIN outbound_orders io ON io.id = rl.outbound_order_id
       GROUP BY ii.id, ii.admission_no, ii.sku, ii.container_no, ii.qty_pieces, ii.qty_remaining, ii.entry_date
       ORDER BY ii.entry_date DESC, ii.id DESC`
    );

    const summary = summaryRows[0] || {
      total_containers_in: 0,
      total_dos_out: 0,
      total_skus_in_zone: 0
    };

    res.renderPage('inventory', { live, summary });
  } catch (err) {
    console.error('Inventory error:', err.message || err);
    res.status(200).renderPage('inventory', {
      live: [],
      summary: { total_containers_in: 0, total_dos_out: 0, total_skus_in_zone: 0 },
      message: 'Database connection failed: ' + (err.message || ''),
      messageType: 'error'
    });
  }
});

module.exports = router;
