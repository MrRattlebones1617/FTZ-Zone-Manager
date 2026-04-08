const pool = require('./db');

async function hasColumn(tableName, columnName) {
  const [rows] = await pool.query(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  return rows.length > 0;
}

async function addColumnIfMissing(tableName, columnName, definition) {
  const exists = await hasColumn(tableName, columnName);
  if (!exists) {
    await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

async function ensureSchema() {
  // Create core tables if they are missing so first-run uploads do not fail.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inbound_inventory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sku VARCHAR(100) NOT NULL,
      carton_qty DECIMAL(18,4) DEFAULT 0,
      qty_pieces DECIMAL(18,4) DEFAULT 0,
      qty_remaining DECIMAL(18,4) DEFAULT 0,
      gross_weight DECIMAL(18,4) DEFAULT 0,
      unit_value DECIMAL(18,4) DEFAULT 0,
      total_value DECIMAL(18,4) DEFAULT 0,
      container_no VARCHAR(100),
      admission_no VARCHAR(100),
      entry_date DATE,
      hts_code VARCHAR(100),
      port_of_entry VARCHAR(100),
      country_of_origin VARCHAR(100),
      mid VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await addColumnIfMissing('inbound_inventory', 'carton_qty', 'DECIMAL(18,4) DEFAULT 0');
  await addColumnIfMissing('inbound_inventory', 'qty_pieces', 'DECIMAL(18,4) DEFAULT 0');
  await addColumnIfMissing('inbound_inventory', 'qty_remaining', 'DECIMAL(18,4) DEFAULT 0');
  await addColumnIfMissing('inbound_inventory', 'gross_weight', 'DECIMAL(18,4) DEFAULT 0');
  await addColumnIfMissing('inbound_inventory', 'unit_value', 'DECIMAL(18,4) DEFAULT 0');
  await addColumnIfMissing('inbound_inventory', 'total_value', 'DECIMAL(18,4) DEFAULT 0');
  await addColumnIfMissing('inbound_inventory', 'container_no', 'VARCHAR(100)');
  await addColumnIfMissing('inbound_inventory', 'admission_no', 'VARCHAR(100)');
  await addColumnIfMissing('inbound_inventory', 'entry_date', 'DATE');
  await addColumnIfMissing('inbound_inventory', 'hts_code', 'VARCHAR(100)');
  await addColumnIfMissing('inbound_inventory', 'port_of_entry', 'VARCHAR(100)');
  await addColumnIfMissing('inbound_inventory', 'country_of_origin', 'VARCHAR(100)');
  await addColumnIfMissing('inbound_inventory', 'mid', 'VARCHAR(100)');

  const inboundHasLegacyQtyReceived = await hasColumn('inbound_inventory', 'qty_received');
  const inboundHasLegacyDateOfEntry = await hasColumn('inbound_inventory', 'date_of_entry');
  if (inboundHasLegacyQtyReceived) {
    await pool.query('UPDATE inbound_inventory SET qty_pieces = COALESCE(NULLIF(qty_pieces, 0), qty_received, 0)');
  }
  await pool.query('UPDATE inbound_inventory SET qty_remaining = COALESCE(NULLIF(qty_remaining, 0), qty_pieces, 0)');
  if (inboundHasLegacyDateOfEntry) {
    await pool.query('UPDATE inbound_inventory SET entry_date = COALESCE(entry_date, date_of_entry)');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS outbound_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer VARCHAR(255),
      po_no VARCHAR(100),
      do_no VARCHAR(100),
      issue_date DATE,
      sku VARCHAR(100) NOT NULL,
      description TEXT,
      qty_shipped DECIMAL(18,4) DEFAULT 0,
      container_no VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await addColumnIfMissing('outbound_orders', 'customer', 'VARCHAR(255)');
  await addColumnIfMissing('outbound_orders', 'po_no', 'VARCHAR(100)');
  await addColumnIfMissing('outbound_orders', 'do_no', 'VARCHAR(100)');
  await addColumnIfMissing('outbound_orders', 'issue_date', 'DATE');
  await addColumnIfMissing('outbound_orders', 'sku', 'VARCHAR(100) NOT NULL');
  await addColumnIfMissing('outbound_orders', 'description', 'TEXT');
  await addColumnIfMissing('outbound_orders', 'qty_shipped', 'DECIMAL(18,4) DEFAULT 0');
  await addColumnIfMissing('outbound_orders', 'container_no', 'VARCHAR(100)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reconciliation_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      inbound_inventory_id INT NOT NULL,
      outbound_order_id INT NOT NULL,
      qty_matched DECIMAL(18,4) DEFAULT 0,
      matched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (inbound_inventory_id) REFERENCES inbound_inventory(id) ON DELETE CASCADE,
      FOREIGN KEY (outbound_order_id) REFERENCES outbound_orders(id) ON DELETE CASCADE
    )
  `);
}

module.exports = { ensureSchema };
