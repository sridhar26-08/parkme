const express = require('express');
const router = express.Router();
const db = require('../db');
const QRCode = require('qrcode');

const VIOLATION_FINE = 25.0; // Fine amount in currency units for parking in someone else's slot
const RESERVATION_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

// Helper: Clean expired reservations
function cleanExpiredReservations() {
  const now = Date.now();
  const expiryCutoff = now - RESERVATION_EXPIRY_MS;

  const expiredSlots = db.prepare(`
    SELECT * FROM slots 
    WHERE status = 'RESERVED' AND reserved_at IS NOT NULL AND reserved_at < ?
  `).all(expiryCutoff);

  if (expiredSlots.length > 0) {
    const updateSlot = db.prepare(`
      UPDATE slots 
      SET status = 'AVAILABLE', current_ticket_id = NULL, reserved_at = NULL 
      WHERE id = ?
    `);
    const updateTicket = db.prepare(`
      UPDATE tickets 
      SET status = 'EXPIRED' 
      WHERE id = ? AND status = 'ACTIVE' AND parked_time IS NULL
    `);

    const cleanupTx = db.transaction(() => {
      for (const slot of expiredSlots) {
        if (slot.current_ticket_id) {
          updateTicket.run(slot.current_ticket_id);
        }
        updateSlot.run(slot.id);
      }
    });

    cleanupTx();
    console.log(`Cleaned up ${expiredSlots.length} expired reservations.`);
  }
}

// Helper: Find nearest available slot
function getNearestAvailableSlot() {
  return db.prepare(`
    SELECT * FROM slots 
    WHERE status = 'AVAILABLE' 
    ORDER BY 
      CASE floor 
        WHEN 'B1' THEN 1 
        WHEN 'B2' THEN 2 
        WHEN 'F1' THEN 3 
        ELSE 4 
      END ASC, 
      slot_number ASC 
    LIMIT 1
  `).get();
}

// Generate unique ticket ID
function generateTicketId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TKT-${rand}`;
}

// Calculate fee based on duration
function calculateParkingFee(entryTime, exitTime = Date.now()) {
  const durationMs = Math.max(0, exitTime - entryTime);
  const minutes = Math.ceil(durationMs / (60 * 1000));
  const hours = Math.ceil(minutes / 60);

  // Mall pricing policy:
  // First hour: $5.00
  // Each subsequent hour: $3.00
  if (hours <= 1) {
    return { fee: 5.0, minutes, hours };
  }
  const fee = 5.0 + (hours - 1) * 3.0;
  return { fee, minutes, hours };
}

// ================= ROUTES ================= //

/**
 * GET /api/slots
 * Get all slots grouped by floor, plus summary counts
 */
router.get('/slots', (req, res) => {
  try {
    cleanExpiredReservations();
    const slots = db.prepare(`
      SELECT s.*, t.entry_time, t.status as ticket_status, t.fine_amount
      FROM slots s
      LEFT JOIN tickets t ON s.current_ticket_id = t.id
      ORDER BY 
        CASE s.floor 
          WHEN 'B1' THEN 1 
          WHEN 'B2' THEN 2 
          WHEN 'F1' THEN 3 
          ELSE 4 
        END ASC, 
        s.slot_number ASC
    `).all();

    const now = Date.now();
    const enrichedSlots = slots.map(slot => {
      let remainingReservationSeconds = 0;
      if (slot.status === 'RESERVED' && slot.reserved_at) {
        const elapsed = now - slot.reserved_at;
        remainingReservationSeconds = Math.max(0, Math.floor((RESERVATION_EXPIRY_MS - elapsed) / 1000));
      }
      return {
        ...slot,
        remainingReservationSeconds
      };
    });

    res.json({ success: true, slots: enrichedSlots });
  } catch (error) {
    console.error('Error fetching slots:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/entry/ticket
 * Issue entry ticket and auto-assign nearest slot (RESERVED)
 */
router.post('/entry/ticket', async (req, res) => {
  try {
    cleanExpiredReservations();

    const ticketId = generateTicketId();
    const now = Date.now();

    const issueTicketTx = db.transaction(() => {
      const nearestSlot = getNearestAvailableSlot();
      if (!nearestSlot) {
        throw new Error('Parking Full: No available parking slots in the mall.');
      }

      // Reserve slot
      db.prepare(`
        UPDATE slots 
        SET status = 'RESERVED', current_ticket_id = ?, reserved_at = ?
        WHERE id = ?
      `).run(ticketId, now, nearestSlot.id);

      // Create ticket
      db.prepare(`
        INSERT INTO tickets (id, entry_time, assigned_slot_id, status, fine_amount)
        VALUES (?, ?, ?, 'ACTIVE', 0)
      `).run(ticketId, now, nearestSlot.id);

      return {
        ticketId,
        entryTime: now,
        assignedSlot: {
          id: nearestSlot.id,
          floor: nearestSlot.floor,
          slotNumber: nearestSlot.slot_number
        },
        expiresAt: now + RESERVATION_EXPIRY_MS
      };
    });

    const result = issueTicketTx();

    // Generate QR code for ticket (can be scanned by driver phone or at exit gate)
    const qrPayload = JSON.stringify({ type: 'TICKET', ticketId: result.ticketId });
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 280,
      color: { dark: '#0f172a', light: '#ffffff' }
    });

    res.status(201).json({
      success: true,
      ticket: result,
      qrDataUrl,
      qrPayload
    });
  } catch (error) {
    console.error('Error issuing ticket:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/tickets/:id
 * Retrieve details for a ticket (for driver companion app)
 */
router.get('/tickets/:id', (req, res) => {
  try {
    cleanExpiredReservations();
    const { id } = req.params;

    const ticket = db.prepare(`
      SELECT t.*, s.floor, s.slot_number, s.status as slot_status, s.reserved_at
      FROM tickets t
      LEFT JOIN slots s ON t.assigned_slot_id = s.id
      WHERE t.id = ?
    `).get(id);

    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    const violations = db.prepare(`
      SELECT * FROM violations WHERE ticket_id = ? ORDER BY timestamp DESC
    `).all(id);

    const now = Date.now();
    let remainingReservationSeconds = 0;
    if (ticket.slot_status === 'RESERVED' && ticket.reserved_at) {
      const elapsed = now - ticket.reserved_at;
      remainingReservationSeconds = Math.max(0, Math.floor((RESERVATION_EXPIRY_MS - elapsed) / 1000));
    }

    res.json({
      success: true,
      ticket: {
        ...ticket,
        remainingReservationSeconds,
        violations
      }
    });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/park/scan-slot
 * Driver parks, scans the physical slot's QR (encodes slot_id).
 * Checks: does slot_id match this ticket's reserved slot?
 * - Yes -> mark slot OCCUPIED, linked to ticket_id.
 * - No (someone else's slot or wrong slot) -> fine this ticket, reassign slot to them,
 *   free up original ticket's reservation and allocate a new slot for the original reservation.
 */
router.post('/park/scan-slot', (req, res) => {
  try {
    cleanExpiredReservations();
    const { ticketId, slotId } = req.body;

    if (!ticketId || !slotId) {
      return res.status(400).json({ success: false, error: 'Both ticketId and slotId are required' });
    }

    const cleanSlotId = slotId.trim().toUpperCase();
    const cleanTicketId = ticketId.trim().toUpperCase();
    const now = Date.now();

    const scanTransaction = db.transaction(() => {
      // 1. Fetch ticket
      const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(cleanTicketId);
      if (!ticket) {
        throw new Error(`Ticket "${cleanTicketId}" not found.`);
      }
      if (ticket.status !== 'ACTIVE') {
        throw new Error(`Ticket is ${ticket.status}. Cannot park.`);
      }

      // 2. Fetch scanned slot
      const scannedSlot = db.prepare('SELECT * FROM slots WHERE id = ?').get(cleanSlotId);
      if (!scannedSlot) {
        throw new Error(`Physical parking slot "${cleanSlotId}" does not exist.`);
      }

      // Case 1: Driver parked in their assigned slot
      if (ticket.assigned_slot_id === cleanSlotId) {
        db.prepare(`
          UPDATE slots 
          SET status = 'OCCUPIED', current_ticket_id = ?, reserved_at = NULL 
          WHERE id = ?
        `).run(ticket.id, cleanSlotId);

        db.prepare(`
          UPDATE tickets 
          SET parked_time = ? 
          WHERE id = ?
        `).run(now, ticket.id);

        return {
          match: true,
          fineApplied: false,
          fineAmount: 0,
          assignedSlotId: cleanSlotId,
          message: `Success! You parked in your reserved slot ${cleanSlotId}. Status is now OCCUPIED.`
        };
      }

      // Case 2: Driver parked in the WRONG slot (someone else's reservation or unassigned slot)
      if (scannedSlot.status === 'OCCUPIED' && scannedSlot.current_ticket_id !== ticket.id) {
        throw new Error(`Slot ${cleanSlotId} is already occupied by vehicle ${scannedSlot.current_ticket_id}.`);
      }

      let victimTicketId = null;
      let victimReassignedSlotId = null;

      // If scanned slot was reserved by someone else (the victim):
      if (scannedSlot.status === 'RESERVED' && scannedSlot.current_ticket_id && scannedSlot.current_ticket_id !== ticket.id) {
        victimTicketId = scannedSlot.current_ticket_id;
      }

      // Apply fine to the offender ticket
      const newFineAmount = (ticket.fine_amount || 0) + VIOLATION_FINE;
      const violationReason = victimTicketId
        ? `Parked in slot ${cleanSlotId} reserved for ${victimTicketId} (was assigned ${ticket.assigned_slot_id})`
        : `Parked in unassigned slot ${cleanSlotId} (was assigned ${ticket.assigned_slot_id})`;

      db.prepare(`
        INSERT INTO violations (ticket_id, slot_id, target_assigned_slot, timestamp, fine_amount, fine_status, reason)
        VALUES (?, ?, ?, ?, ?, 'APPLIED', ?)
      `).run(ticket.id, cleanSlotId, ticket.assigned_slot_id, now, VIOLATION_FINE, violationReason);

      db.prepare(`
        UPDATE tickets 
        SET fine_amount = ?, assigned_slot_id = ?, parked_time = ?
        WHERE id = ?
      `).run(newFineAmount, cleanSlotId, now, ticket.id);

      // Free the offender's previous assigned slot
      if (ticket.assigned_slot_id && ticket.assigned_slot_id !== cleanSlotId) {
        db.prepare(`
          UPDATE slots 
          SET status = 'AVAILABLE', current_ticket_id = NULL, reserved_at = NULL 
          WHERE id = ?
        `).run(ticket.assigned_slot_id);
      }

      // Assign scanned slot to offender as OCCUPIED
      db.prepare(`
        UPDATE slots 
        SET status = 'OCCUPIED', current_ticket_id = ?, reserved_at = NULL 
        WHERE id = ?
      `).run(ticket.id, cleanSlotId);

      // Now resolve the victim ticket whose reserved slot was stolen
      if (victimTicketId) {
        const replacementSlot = getNearestAvailableSlot();
        if (replacementSlot) {
          db.prepare(`
            UPDATE slots 
            SET status = 'RESERVED', current_ticket_id = ?, reserved_at = ?
            WHERE id = ?
          `).run(victimTicketId, now, replacementSlot.id);

          db.prepare(`
            UPDATE tickets 
            SET assigned_slot_id = ? 
            WHERE id = ?
          `).run(replacementSlot.id, victimTicketId);

          victimReassignedSlotId = replacementSlot.id;
        } else {
          // If no slot is immediately free, victim remains active but assigned slot set to pending
          db.prepare(`
            UPDATE tickets 
            SET assigned_slot_id = NULL 
            WHERE id = ?
          `).run(victimTicketId);
        }
      }

      return {
        match: false,
        fineApplied: true,
        fineAmount: VIOLATION_FINE,
        totalFines: newFineAmount,
        originalAssignedSlot: ticket.assigned_slot_id,
        newAssignedSlot: cleanSlotId,
        victimTicketId,
        victimReassignedSlotId,
        message: `Violation recorded! You parked in ${cleanSlotId} instead of your assigned slot ${ticket.assigned_slot_id}. A fine of $${VIOLATION_FINE.toFixed(2)} has been added. Slot ${cleanSlotId} is now assigned to you.`
      };
    });

    const result = scanTransaction();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error during slot scan:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/exit/quote/:ticketId
 * Calculate parking fee + fines before payment
 */
router.get('/exit/quote/:ticketId', (req, res) => {
  try {
    cleanExpiredReservations();
    const { ticketId } = req.params;
    const cleanId = ticketId.trim().toUpperCase();

    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(cleanId);
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    const { fee, minutes, hours } = calculateParkingFee(ticket.entry_time);
    const fines = ticket.fine_amount || 0;
    const totalAmount = fee + fines;

    const violations = db.prepare('SELECT * FROM violations WHERE ticket_id = ?').all(cleanId);

    res.json({
      success: true,
      ticketId: cleanId,
      entryTime: ticket.entry_time,
      parkedTime: ticket.parked_time,
      status: ticket.status,
      assignedSlotId: ticket.assigned_slot_id,
      durationMinutes: minutes,
      durationHours: hours,
      parkingFee: fee,
      fineAmount: fines,
      totalAmount,
      violations
    });
  } catch (error) {
    console.error('Error calculating exit quote:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/exit/pay
 * Payment settlement: marks ticket PAID, frees slot back to AVAILABLE
 */
router.post('/exit/pay', (req, res) => {
  try {
    const { ticketId, paymentMethod = 'CARD' } = req.body;
    if (!ticketId) {
      return res.status(400).json({ success: false, error: 'ticketId is required' });
    }
    const cleanId = ticketId.trim().toUpperCase();
    const now = Date.now();

    const payTx = db.transaction(() => {
      const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(cleanId);
      if (!ticket) {
        throw new Error('Ticket not found.');
      }
      if (ticket.status === 'PAID') {
        throw new Error('This ticket has already been paid and settled.');
      }

      const { fee } = calculateParkingFee(ticket.entry_time, now);
      const totalAmount = fee + (ticket.fine_amount || 0);

      // Free any slot associated with this ticket
      db.prepare(`
        UPDATE slots 
        SET status = 'AVAILABLE', current_ticket_id = NULL, reserved_at = NULL 
        WHERE current_ticket_id = ? OR id = ?
      `).run(cleanId, ticket.assigned_slot_id);

      // Update ticket
      db.prepare(`
        UPDATE tickets 
        SET status = 'PAID', exit_time = ?, parking_fee = ?, total_paid = ? 
        WHERE id = ?
      `).run(now, fee, totalAmount, cleanId);

      // Mark violations as PAID
      db.prepare(`
        UPDATE violations 
        SET fine_status = 'PAID' 
        WHERE ticket_id = ?
      `).run(cleanId);

      return {
        ticketId: cleanId,
        freedSlotId: ticket.assigned_slot_id,
        parkingFee: fee,
        fineAmount: ticket.fine_amount || 0,
        totalPaid: totalAmount,
        paymentMethod,
        exitTime: now
      };
    });

    const receipt = payTx();
    res.json({
      success: true,
      message: 'Payment received. Thank you for visiting! Exit gate opened.',
      receipt
    });
  } catch (error) {
    console.error('Error settling payment:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/overview
 * Real-time stats, occupancy, revenue, violations
 */
router.get('/admin/overview', (req, res) => {
  try {
    cleanExpiredReservations();

    const slotStats = db.prepare(`
      SELECT 
        COUNT(*) as totalSlots,
        SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) as availableSlots,
        SUM(CASE WHEN status = 'RESERVED' THEN 1 ELSE 0 END) as reservedSlots,
        SUM(CASE WHEN status = 'OCCUPIED' THEN 1 ELSE 0 END) as occupiedSlots
      FROM slots
    `).get();

    const occupancyRate = slotStats.totalSlots > 0
      ? Math.round(((slotStats.reservedSlots + slotStats.occupiedSlots) / slotStats.totalSlots) * 100)
      : 0;

    const ticketStats = db.prepare(`
      SELECT 
        COUNT(*) as totalTicketsIssued,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as activeTickets,
        SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as paidTickets,
        COALESCE(SUM(total_paid), 0) as totalRevenue,
        COALESCE(SUM(CASE WHEN status = 'ACTIVE' THEN fine_amount ELSE 0 END), 0) as outstandingFines
      FROM tickets
    `).get();

    const violations = db.prepare(`
      SELECT * FROM violations ORDER BY timestamp DESC LIMIT 30
    `).all();

    res.json({
      success: true,
      stats: {
        ...slotStats,
        occupancyRate,
        ...ticketStats,
        totalViolationsCount: violations.length
      },
      violations
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/qr/slot/:slotId
 * Return QR code data URL for physical slot sticker
 */
router.get('/qr/slot/:slotId', async (req, res) => {
  try {
    const { slotId } = req.params;
    const cleanSlotId = slotId.trim().toUpperCase();
    const qrPayload = JSON.stringify({ type: 'SLOT', slotId: cleanSlotId });
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 320,
      color: { dark: '#0f172a', light: '#ffffff' }
    });

    res.json({
      success: true,
      slotId: cleanSlotId,
      qrPayload,
      qrDataUrl
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/reset
 * Reset system for clean demonstration
 */
router.post('/admin/reset', (req, res) => {
  try {
    const resetTx = db.transaction(() => {
      db.prepare(`UPDATE slots SET status = 'AVAILABLE', current_ticket_id = NULL, reserved_at = NULL`).run();
      db.prepare(`DELETE FROM violations`).run();
      db.prepare(`DELETE FROM tickets`).run();
    });
    resetTx();
    res.json({ success: true, message: 'Mall parking system reset to empty state.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/time-warp
 * Test utility: simulate 16 minutes passing to demonstrate 15-minute expiry
 */
router.post('/admin/time-warp', (req, res) => {
  try {
    const sixteenMinsAgo = Date.now() - (16 * 60 * 1000);
    db.prepare(`
      UPDATE slots 
      SET reserved_at = ? 
      WHERE status = 'RESERVED' AND reserved_at IS NOT NULL
    `).run(sixteenMinsAgo);

    cleanExpiredReservations();

    res.json({ success: true, message: 'Time warped by 16 minutes. Expired reservations reclaimed.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
