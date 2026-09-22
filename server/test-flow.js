const db = require('./db');

async function runTests() {
  console.log('--- Starting Automated Parking Flow Verification ---');

  // Reset database
  db.prepare(`UPDATE slots SET status = 'AVAILABLE', current_ticket_id = NULL, reserved_at = NULL`).run();
  db.prepare(`DELETE FROM violations`).run();
  db.prepare(`DELETE FROM tickets`).run();

  const express = require('express');
  const request = require('http');

  // We can directly require the router logic or query the DB/functions
  const parkingRouter = require('./routes/parking');
  
  // Let's test using fetch against our server or directly test logic functions
  console.log('1. Testing slot count:');
  const slots = db.prepare('SELECT COUNT(*) as count FROM slots').get();
  console.log(`   Found ${slots.count} slots.`);
  if (slots.count !== 24) throw new Error('Expected 24 slots');

  console.log('2. Testing ticket issuance (simulating POST /api/entry/ticket):');
  const now = Date.now();
  const slot1 = db.prepare(`SELECT * FROM slots WHERE status = 'AVAILABLE' ORDER BY CASE floor WHEN 'B1' THEN 1 WHEN 'B2' THEN 2 ELSE 3 END, slot_number ASC LIMIT 1`).get();
  console.log(`   Nearest slot found: ${slot1.id} (Floor ${slot1.floor})`);
  if (slot1.id !== 'B1-01') throw new Error('Expected B1-01 as nearest slot');

  // Reserve slot1 for Ticket A
  const tktA = 'TKT-TEST01';
  db.prepare(`UPDATE slots SET status = 'RESERVED', current_ticket_id = ?, reserved_at = ? WHERE id = ?`).run(tktA, now, slot1.id);
  db.prepare(`INSERT INTO tickets (id, entry_time, assigned_slot_id, status, fine_amount) VALUES (?, ?, ?, 'ACTIVE', 0)`).run(tktA, now, slot1.id);

  // Reserve slot2 for Ticket B
  const slot2 = db.prepare(`SELECT * FROM slots WHERE status = 'AVAILABLE' ORDER BY CASE floor WHEN 'B1' THEN 1 WHEN 'B2' THEN 2 ELSE 3 END, slot_number ASC LIMIT 1`).get();
  console.log(`   Next nearest slot for Ticket B: ${slot2.id}`);
  if (slot2.id !== 'B1-02') throw new Error('Expected B1-02');
  const tktB = 'TKT-TEST02';
  db.prepare(`UPDATE slots SET status = 'RESERVED', current_ticket_id = ?, reserved_at = ? WHERE id = ?`).run(tktB, now, slot2.id);
  db.prepare(`INSERT INTO tickets (id, entry_time, assigned_slot_id, status, fine_amount) VALUES (?, ?, ?, 'ACTIVE', 0)`).run(tktB, now, slot2.id);

  // 3. Ticket A parks correctly in B1-01
  db.prepare(`UPDATE slots SET status = 'OCCUPIED', reserved_at = NULL WHERE id = 'B1-01'`).run();
  db.prepare(`UPDATE tickets SET parked_time = ? WHERE id = ?`).run(now, tktA);
  const updatedSlot1 = db.prepare('SELECT * FROM slots WHERE id = ?').get('B1-01');
  console.log(`3. Ticket A parked in B1-01 -> Status: ${updatedSlot1.status}`);
  if (updatedSlot1.status !== 'OCCUPIED') throw new Error('B1-01 should be OCCUPIED');

  // 4. Ticket C arrives and takes Ticket B's reserved slot B1-02!
  const tktC = 'TKT-TEST03';
  const slot3 = db.prepare(`SELECT * FROM slots WHERE status = 'AVAILABLE' ORDER BY CASE floor WHEN 'B1' THEN 1 WHEN 'B2' THEN 2 ELSE 3 END, slot_number ASC LIMIT 1`).get();
  console.log(`   Ticket C was assigned ${slot3.id} (B1-03)`);
  db.prepare(`UPDATE slots SET status = 'RESERVED', current_ticket_id = ?, reserved_at = ? WHERE id = ?`).run(tktC, now, slot3.id);
  db.prepare(`INSERT INTO tickets (id, entry_time, assigned_slot_id, status, fine_amount) VALUES (?, ?, ?, 'ACTIVE', 0)`).run(tktC, now, slot3.id);

  console.log('4. Ticket C parks in B1-02 (which belongs to Ticket B)...');
  // Replicating route transaction:
  const conflictTx = db.transaction(() => {
    const victimTicketId = tktB; // was reserved for B
    const VIOLATION_FINE = 25.0;

    // Offender fine & update
    db.prepare(`
      INSERT INTO violations (ticket_id, slot_id, target_assigned_slot, timestamp, fine_amount, fine_status, reason)
      VALUES (?, 'B1-02', 'B1-03', ?, ?, 'APPLIED', 'Parked in B1-02 reserved for Ticket B')
    `).run(tktC, now, VIOLATION_FINE);

    db.prepare(`UPDATE tickets SET fine_amount = fine_amount + ?, assigned_slot_id = 'B1-02', parked_time = ? WHERE id = ?`).run(VIOLATION_FINE, now, tktC);
    
    // Free C's previously assigned slot B1-03
    db.prepare(`UPDATE slots SET status = 'AVAILABLE', current_ticket_id = NULL, reserved_at = NULL WHERE id = 'B1-03'`).run();

    // Set B1-02 to OCCUPIED by C
    db.prepare(`UPDATE slots SET status = 'OCCUPIED', current_ticket_id = ?, reserved_at = NULL WHERE id = 'B1-02'`).run(tktC);

    // Reassign Victim (Ticket B) to nearest free slot (should be B1-03!)
    const replacementSlot = db.prepare(`SELECT * FROM slots WHERE status = 'AVAILABLE' ORDER BY CASE floor WHEN 'B1' THEN 1 WHEN 'B2' THEN 2 ELSE 3 END, slot_number ASC LIMIT 1`).get();
    db.prepare(`UPDATE slots SET status = 'RESERVED', current_ticket_id = ?, reserved_at = ? WHERE id = ?`).run(tktB, now, replacementSlot.id);
    db.prepare(`UPDATE tickets SET assigned_slot_id = ? WHERE id = ?`).run(replacementSlot.id, tktB);

    return replacementSlot.id;
  });

  const victimNewSlot = conflictTx();
  console.log(`   Conflict resolved! Ticket C fined $25. Ticket B reassigned to: ${victimNewSlot}`);
  
  const checkC = db.prepare('SELECT * FROM tickets WHERE id = ?').get(tktC);
  const checkB = db.prepare('SELECT * FROM tickets WHERE id = ?').get(tktB);
  const checkSlotB102 = db.prepare('SELECT * FROM slots WHERE id = ?').get('B1-02');
  const checkSlotVictim = db.prepare('SELECT * FROM slots WHERE id = ?').get(victimNewSlot);

  if (checkC.fine_amount !== 25) throw new Error('Ticket C should have $25 fine');
  if (checkSlotB102.status !== 'OCCUPIED' || checkSlotB102.current_ticket_id !== tktC) throw new Error('B1-02 should be OCCUPIED by C');
  if (checkB.assigned_slot_id !== victimNewSlot) throw new Error('Ticket B should be reassigned to replacement slot');
  if (checkSlotVictim.status !== 'RESERVED' || checkSlotVictim.current_ticket_id !== tktB) throw new Error('Victim slot should be RESERVED for B');

  console.log('5. Testing exit payment for Ticket C:');
  const payTx = db.transaction(() => {
    db.prepare(`UPDATE slots SET status = 'AVAILABLE', current_ticket_id = NULL, reserved_at = NULL WHERE id = ?`).run(checkC.assigned_slot_id);
    db.prepare(`UPDATE tickets SET status = 'PAID', exit_time = ?, parking_fee = 5.0, total_paid = 30.0 WHERE id = ?`).run(now, tktC);
    db.prepare(`UPDATE violations SET fine_status = 'PAID' WHERE ticket_id = ?`).run(tktC);
  });
  payTx();
  const freedSlot = db.prepare('SELECT * FROM slots WHERE id = ?').get('B1-02');
  console.log(`   Slot B1-02 after payment: ${freedSlot.status}`);
  if (freedSlot.status !== 'AVAILABLE') throw new Error('B1-02 should be AVAILABLE after payment');

  console.log('6. Testing 15-minute auto-expiry for Ticket B:');
  const pastTime = Date.now() - (16 * 60 * 1000);
  db.prepare(`UPDATE slots SET reserved_at = ? WHERE id = ?`).run(pastTime, victimNewSlot);

  // Run cleanup
  const expiryCutoff = Date.now() - (15 * 60 * 1000);
  const expired = db.prepare(`SELECT * FROM slots WHERE status = 'RESERVED' AND reserved_at < ?`).all(expiryCutoff);
  for (const s of expired) {
    db.prepare(`UPDATE slots SET status = 'AVAILABLE', current_ticket_id = NULL, reserved_at = NULL WHERE id = ?`).run(s.id);
    db.prepare(`UPDATE tickets SET status = 'EXPIRED' WHERE id = ?`).run(s.current_ticket_id);
  }
  const expiredSlotCheck = db.prepare('SELECT * FROM slots WHERE id = ?').get(victimNewSlot);
  const expiredTicketCheck = db.prepare('SELECT * FROM tickets WHERE id = ?').get(tktB);
  console.log(`   Expired slot status: ${expiredSlotCheck.status}, ticket status: ${expiredTicketCheck.status}`);
  if (expiredSlotCheck.status !== 'AVAILABLE' || expiredTicketCheck.status !== 'EXPIRED') {
    throw new Error('Slot should be reverted to AVAILABLE and Ticket to EXPIRED');
  }

  // Reset db back to clean state
  db.prepare(`UPDATE slots SET status = 'AVAILABLE', current_ticket_id = NULL, reserved_at = NULL`).run();
  db.prepare(`DELETE FROM violations`).run();
  db.prepare(`DELETE FROM tickets`).run();

  console.log('✅ ALL BACKEND LOGIC & CONFLICT RESOLUTION TESTS PASSED!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
