/**
 * Matching Engine: FIFO match outbound quantities against inbound_inventory
 */
const pool = require('../db');

async function processOutboundEntries(entries) {
  // entries: array of objects with keys matching expected outbound columns
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const e of entries) {
      const customer = e.customer || '';
      const po_no = e.po_no || '';
      const do_no = e.do_no || '';
      const issue_date = e.issue_date || null;
      const sku = e.sku || '';
      const description = e.description || '';
      const qty_shipped = Number(e.qty_shipped || 0);
      const container_no = e.container_no || null;

      const [res] = await conn.query(
        'INSERT INTO outbound_orders (customer, po_no, do_no, issue_date, sku, description, qty_shipped, container_no) VALUES (?,?,?,?,?,?,?,?)',
        [customer, po_no, do_no, issue_date ? new Date(issue_date) : null, sku, description, qty_shipped, container_no]
      );
      const outboundId = res.insertId;

      let remaining = qty_shipped;
      if (!sku || remaining <= 0) continue;

      // FIFO by oldest inbound entry date, then oldest row id.
      const [inbounds] = await conn.query(
        'SELECT * FROM inbound_inventory WHERE sku = ? AND qty_remaining > 0 ORDER BY entry_date ASC, id ASC',
        [sku]
      );

      for (const inb of inbounds) {
        if (remaining <= 0) break;
        const available = Number(inb.qty_remaining || 0);
        if (available <= 0) continue;

        const take = Math.min(available, remaining);
        // create reconciliation log
        await conn.query(
          'INSERT INTO reconciliation_log (inbound_inventory_id, outbound_order_id, qty_matched) VALUES (?,?,?)',
          [inb.id, outboundId, take]
        );

        // update inbound qty_remaining
        const newRemaining = Number((available - take).toFixed(6));
        await conn.query('UPDATE inbound_inventory SET qty_remaining = ? WHERE id = ?', [newRemaining, inb.id]);

        remaining = Number((remaining - take).toFixed(6));
      }

      // note: if remaining > 0 after looping, outbound is partially or not fulfilled
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { processOutboundEntries };
