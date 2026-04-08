-- SQL schema for FTZ Zone Manager
CREATE DATABASE IF NOT EXISTS ftz_zone_manager;
USE ftz_zone_manager;

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
  INDEX idx_inbound_sku_entry (sku, entry_date, id),
  INDEX idx_inbound_admission (admission_no),
  INDEX idx_inbound_container (container_no)
);

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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_outbound_do_po (do_no, po_no),
  INDEX idx_outbound_sku_issue (sku, issue_date, id)
);

CREATE TABLE IF NOT EXISTS reconciliation_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  inbound_inventory_id INT NOT NULL,
  outbound_order_id INT NOT NULL,
  qty_matched DECIMAL(18,4) DEFAULT 0,
  matched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inbound_inventory_id) REFERENCES inbound_inventory(id) ON DELETE CASCADE,
  FOREIGN KEY (outbound_order_id) REFERENCES outbound_orders(id) ON DELETE CASCADE,
  INDEX idx_recon_outbound (outbound_order_id),
  INDEX idx_recon_inbound (inbound_inventory_id)
);
