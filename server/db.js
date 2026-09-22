const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'parking.db');
const db = new Database(dbPath);

// Enable WAL mode for high performance & concurrency
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS slots (
    id TEXT PRIMARY KEY,
    floor TEXT NOT NULL,
    slot_number INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'RESERVED', 'OCCUPIED')),
    current_ticket_id TEXT,
    reserved_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    entry_time INTEGER NOT NULL,
    parked_time INTEGER,
    exit_time INTEGER,
    assigned_slot_id TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAID', 'EXPIRED')),
    fine_amount REAL DEFAULT 0,
    parking_fee REAL DEFAULT 0,
    total_paid REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS violations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT NOT NULL,
    slot_id TEXT NOT NULL,
    target_assigned_slot TEXT,
    timestamp INTEGER NOT NULL,
    fine_amount REAL NOT NULL,
    fine_status TEXT NOT NULL DEFAULT 'APPLIED' CHECK (fine_status IN ('APPLIED', 'PAID')),
    reason TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_slots_floor ON slots(floor);
  CREATE INDEX IF NOT EXISTS idx_slots_status ON slots(status);
  CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
  CREATE INDEX IF NOT EXISTS idx_violations_ticket ON violations(ticket_id);
`);

// Seed slots if empty
const countSlots = db.prepare('SELECT COUNT(*) as count FROM slots').get();
if (countSlots.count === 0) {
  const insertSlot = db.prepare(`
    INSERT INTO slots (id, floor, slot_number, status, current_ticket_id, reserved_at)
    VALUES (?, ?, ?, 'AVAILABLE', NULL, NULL)
  `);

  const seedTransaction = db.transaction(() => {
    const floors = [
      { name: 'B1', label: 'Basement 1', count: 8 },
      { name: 'B2', label: 'Basement 2', count: 8 },
      { name: 'F1', label: 'Floor 1', count: 8 },
    ];

    for (const fl of floors) {
      for (let i = 1; i <= fl.count; i++) {
        const slotId = `${fl.name}-${String(i).padStart(2, '0')}`;
        insertSlot.run(slotId, fl.name, i);
      }
    }
  });

  seedTransaction();
  console.log('Seeded 24 mall parking slots across 3 floors (B1, B2, F1).');
}

module.exports = db;
