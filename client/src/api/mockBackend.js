/**
 * In-Browser Parking Simulation Engine for ParkMe
 * Allows the full app to run seamlessly as a standalone static demo on GitHub Pages
 * without requiring a running Node.js / SQLite backend!
 */
import QRCode from 'qrcode';
import { broadcastStateChange, BACKEND_URL } from './syncChannel';

const VIOLATION_FINE = 25.0;
const RESERVATION_EXPIRY_MS = 15 * 60 * 1000; // 15 mins

const STORAGE_KEY = 'parkme_mock_db_v1';

function initializeSlots() {
  const floors = [
    { floor: 'B1', count: 8 },
    { floor: 'B2', count: 8 },
    { floor: 'F1', count: 8 }
  ];
  const slots = [];
  for (const f of floors) {
    for (let i = 1; i <= f.count; i++) {
      const numStr = i < 10 ? `0${i}` : `${i}`;
      slots.push({
        id: `${f.floor}-${numStr}`,
        floor: f.floor,
        slot_number: i,
        status: 'AVAILABLE',
        current_ticket_id: null,
        reserved_at: null
      });
    }
  }
  return slots;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return {
    slots: initializeSlots(),
    tickets: {},
    violations: []
  };
}

function saveState(state, eventType = 'UPDATE') {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    // Broadcast to other open tabs so they refresh instantly
    broadcastStateChange(eventType, { ts: Date.now() });
  } catch {
    // ignore
  }
}

function cleanExpired(state) {
  const now = Date.now();
  const expiryCutoff = now - RESERVATION_EXPIRY_MS;
  for (const s of state.slots) {
    if (s.status === 'RESERVED' && s.reserved_at && s.reserved_at < expiryCutoff) {
      if (s.current_ticket_id && state.tickets[s.current_ticket_id]) {
        state.tickets[s.current_ticket_id].status = 'EXPIRED';
      }
      s.status = 'AVAILABLE';
      s.current_ticket_id = null;
      s.reserved_at = null;
    }
  }
}

function getNearestSlot(state) {
  const floorOrder = { B1: 1, B2: 2, F1: 3 };
  const avail = state.slots
    .filter(s => s.status === 'AVAILABLE')
    .sort((a, b) => {
      const fa = floorOrder[a.floor] || 9;
      const fb = floorOrder[b.floor] || 9;
      if (fa !== fb) return fa - fb;
      return a.slot_number - b.slot_number;
    });
  return avail[0] || null;
}

function generateTicketId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TKT-${rand}`;
}

function calculateParkingFee(entryTime, exitTime = Date.now()) {
  const durationMs = Math.max(0, exitTime - entryTime);
  const minutes = Math.ceil(durationMs / (60 * 1000));
  const hours = Math.ceil(minutes / 60);
  if (hours <= 1) return { fee: 5.0, minutes, hours };
  return { fee: 5.0 + (hours - 1) * 3.0, minutes, hours };
}

export async function handleMockApi(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const state = loadState();
  cleanExpired(state);

  const now = Date.now();

  // GET /api/slots
  if (path === '/api/slots' && method === 'GET') {
    const enrichedSlots = state.slots.map(s => {
      let remainingReservationSeconds = 0;
      if (s.status === 'RESERVED' && s.reserved_at) {
        const elapsed = now - s.reserved_at;
        remainingReservationSeconds = Math.max(0, Math.floor((RESERVATION_EXPIRY_MS - elapsed) / 1000));
      }
      const ticket = s.current_ticket_id ? state.tickets[s.current_ticket_id] : null;
      return {
        ...s,
        entry_time: ticket?.entry_time || null,
        ticket_status: ticket?.status || null,
        fine_amount: ticket?.fine_amount || 0,
        remainingReservationSeconds
      };
    });
    saveState(state);
    return { success: true, slots: enrichedSlots };
  }

  // POST /api/entry/ticket
  if (path === '/api/entry/ticket' && method === 'POST') {
    const nearestSlot = getNearestSlot(state);
    if (!nearestSlot) {
      return { success: false, error: 'Parking Full: No available parking slots in the mall.' };
    }
    const ticketId = generateTicketId();
    nearestSlot.status = 'RESERVED';
    nearestSlot.current_ticket_id = ticketId;
    nearestSlot.reserved_at = now;

    state.tickets[ticketId] = {
      id: ticketId,
      entry_time: now,
      assigned_slot_id: nearestSlot.id,
      status: 'ACTIVE',
      fine_amount: 0,
      parked_time: null
    };

    const qrPayload = JSON.stringify({ type: 'TICKET', ticketId });
    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(qrPayload, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 280,
        color: { dark: '#0f172a', light: '#ffffff' }
      });
    } catch {
      qrDataUrl = '';
    }

    saveState(state);
    return {
      success: true,
      ticket: {
        ticketId,
        entryTime: now,
        assignedSlot: {
          id: nearestSlot.id,
          floor: nearestSlot.floor,
          slotNumber: nearestSlot.slot_number
        },
        expiresAt: now + RESERVATION_EXPIRY_MS
      },
      qrDataUrl,
      qrPayload
    };
  }

  // GET /api/tickets/:id
  if (path.startsWith('/api/tickets/') && method === 'GET') {
    const id = path.replace('/api/tickets/', '').trim().toUpperCase();
    const ticket = state.tickets[id];
    if (!ticket) return { success: false, error: 'Ticket not found' };

    const slot = state.slots.find(s => s.id === ticket.assigned_slot_id);
    let remainingReservationSeconds = 0;
    if (slot && slot.status === 'RESERVED' && slot.reserved_at) {
      const elapsed = now - slot.reserved_at;
      remainingReservationSeconds = Math.max(0, Math.floor((RESERVATION_EXPIRY_MS - elapsed) / 1000));
    }

    const ticketViolations = state.violations.filter(v => v.ticket_id === id);
    return {
      success: true,
      ticket: {
        ...ticket,
        floor: slot?.floor || 'B1',
        slot_number: slot?.slot_number || 1,
        slot_status: slot?.status || 'AVAILABLE',
        remainingReservationSeconds,
        violations: ticketViolations
      }
    };
  }

  // POST /api/park/scan-slot
  if (path === '/api/park/scan-slot' && method === 'POST') {
    const body = options.body ? JSON.parse(options.body) : {};
    const { ticketId, slotId } = body;
    if (!ticketId || !slotId) {
      return { success: false, error: 'Both ticketId and slotId are required' };
    }

    const cleanSlotId = slotId.trim().toUpperCase();
    const cleanTicketId = ticketId.trim().toUpperCase();
    const ticket = state.tickets[cleanTicketId];
    if (!ticket) return { success: false, error: `Ticket "${cleanTicketId}" not found.` };
    if (ticket.status !== 'ACTIVE') return { success: false, error: `Ticket is ${ticket.status}. Cannot park.` };

    const scannedSlot = state.slots.find(s => s.id === cleanSlotId);
    if (!scannedSlot) return { success: false, error: `Slot "${cleanSlotId}" does not exist.` };

    // Correct Bay
    if (ticket.assigned_slot_id === cleanSlotId) {
      scannedSlot.status = 'OCCUPIED';
      scannedSlot.current_ticket_id = ticket.id;
      scannedSlot.reserved_at = null;
      ticket.parked_time = now;
      saveState(state);
      return {
        success: true,
        match: true,
        fineApplied: false,
        fineAmount: 0,
        assignedSlotId: cleanSlotId,
        message: `Success! You parked in your reserved slot ${cleanSlotId}. Status is now OCCUPIED.`
      };
    }

    // Wrong Bay Conflict
    if (scannedSlot.status === 'OCCUPIED' && scannedSlot.current_ticket_id !== ticket.id) {
      return { success: false, error: `Slot ${cleanSlotId} is already occupied by vehicle ${scannedSlot.current_ticket_id}.` };
    }

    let victimTicketId = null;
    let victimReassignedSlotId = null;

    if (scannedSlot.status === 'RESERVED' && scannedSlot.current_ticket_id && scannedSlot.current_ticket_id !== ticket.id) {
      victimTicketId = scannedSlot.current_ticket_id;
    }

    const newFine = (ticket.fine_amount || 0) + VIOLATION_FINE;
    const violationReason = victimTicketId
      ? `Parked in slot ${cleanSlotId} reserved for ${victimTicketId} (was assigned ${ticket.assigned_slot_id})`
      : `Parked in unassigned slot ${cleanSlotId} (was assigned ${ticket.assigned_slot_id})`;

    state.violations.unshift({
      id: Date.now(),
      ticket_id: ticket.id,
      slot_id: cleanSlotId,
      target_assigned_slot: ticket.assigned_slot_id,
      timestamp: now,
      fine_amount: VIOLATION_FINE,
      fine_status: 'APPLIED',
      reason: violationReason
    });

    ticket.fine_amount = newFine;
    const oldSlotId = ticket.assigned_slot_id;
    ticket.assigned_slot_id = cleanSlotId;
    ticket.parked_time = now;

    // Free offender's previous slot
    if (oldSlotId && oldSlotId !== cleanSlotId) {
      const oldSlot = state.slots.find(s => s.id === oldSlotId);
      if (oldSlot) {
        oldSlot.status = 'AVAILABLE';
        oldSlot.current_ticket_id = null;
        oldSlot.reserved_at = null;
      }
    }

    // Take scanned slot
    scannedSlot.status = 'OCCUPIED';
    scannedSlot.current_ticket_id = ticket.id;
    scannedSlot.reserved_at = null;

    // Reassign victim if slot was stolen
    if (victimTicketId) {
      const victimTicket = state.tickets[victimTicketId];
      const replacementSlot = getNearestSlot(state);
      if (replacementSlot && victimTicket) {
        replacementSlot.status = 'RESERVED';
        replacementSlot.current_ticket_id = victimTicketId;
        replacementSlot.reserved_at = now;
        victimTicket.assigned_slot_id = replacementSlot.id;
        victimReassignedSlotId = replacementSlot.id;
      } else if (victimTicket) {
        victimTicket.assigned_slot_id = null;
      }
    }

    saveState(state);
    return {
      success: true,
      match: false,
      fineApplied: true,
      fineAmount: VIOLATION_FINE,
      totalFines: newFine,
      originalAssignedSlot: oldSlotId,
      newAssignedSlot: cleanSlotId,
      victimTicketId,
      victimReassignedSlotId,
      message: `Violation recorded! You parked in ${cleanSlotId} instead of your assigned slot ${oldSlotId}. A fine of $${VIOLATION_FINE.toFixed(2)} has been added. Slot ${cleanSlotId} is now assigned to you.`
    };
  }

  // GET /api/exit/quote/:ticketId
  if (path.startsWith('/api/exit/quote/') && method === 'GET') {
    const id = path.replace('/api/exit/quote/', '').trim().toUpperCase();
    const ticket = state.tickets[id];
    if (!ticket) return { success: false, error: 'Ticket not found' };

    const { fee, minutes, hours } = calculateParkingFee(ticket.entry_time, now);
    const fines = ticket.fine_amount || 0;
    const totalAmount = fee + fines;
    const ticketViolations = state.violations.filter(v => v.ticket_id === id);

    return {
      success: true,
      ticketId: id,
      entryTime: ticket.entry_time,
      parkedTime: ticket.parked_time,
      status: ticket.status,
      assignedSlotId: ticket.assigned_slot_id,
      durationMinutes: minutes,
      durationHours: hours,
      parkingFee: fee,
      fineAmount: fines,
      totalAmount,
      violations: ticketViolations
    };
  }

  // POST /api/exit/pay
  if (path === '/api/exit/pay' && method === 'POST') {
    const body = options.body ? JSON.parse(options.body) : {};
    const { ticketId, paymentMethod = 'CARD' } = body;
    if (!ticketId) return { success: false, error: 'ticketId is required' };

    const cleanId = ticketId.trim().toUpperCase();
    const ticket = state.tickets[cleanId];
    if (!ticket) return { success: false, error: 'Ticket not found.' };
    if (ticket.status === 'PAID') return { success: false, error: 'This ticket has already been paid and settled.' };

    const { fee } = calculateParkingFee(ticket.entry_time, now);
    const totalAmount = fee + (ticket.fine_amount || 0);

    // Free slot
    for (const s of state.slots) {
      if (s.current_ticket_id === cleanId || s.id === ticket.assigned_slot_id) {
        s.status = 'AVAILABLE';
        s.current_ticket_id = null;
        s.reserved_at = null;
      }
    }

    ticket.status = 'PAID';
    ticket.exit_time = now;
    ticket.parking_fee = fee;
    ticket.total_paid = totalAmount;

    for (const v of state.violations) {
      if (v.ticket_id === cleanId) {
        v.fine_status = 'PAID';
      }
    }

    saveState(state);
    return {
      success: true,
      message: 'Payment received. Thank you for visiting! Exit gate opened.',
      receipt: {
        ticketId: cleanId,
        freedSlotId: ticket.assigned_slot_id,
        parkingFee: fee,
        fineAmount: ticket.fine_amount || 0,
        totalPaid: totalAmount,
        paymentMethod,
        exitTime: now,
        receiptNumber: `RCP-${Math.floor(100000 + Math.random() * 900000)}`
      }
    };
  }

  // GET /api/admin/overview
  if (path === '/api/admin/overview' && method === 'GET') {
    const totalSlots = state.slots.length;
    const availableSlots = state.slots.filter(s => s.status === 'AVAILABLE').length;
    const reservedSlots = state.slots.filter(s => s.status === 'RESERVED').length;
    const occupiedSlots = state.slots.filter(s => s.status === 'OCCUPIED').length;
    const occupancyRate = totalSlots > 0 ? Math.round(((reservedSlots + occupiedSlots) / totalSlots) * 100) : 0;

    const ticketList = Object.values(state.tickets);
    const totalTicketsIssued = ticketList.length;
    const activeTickets = ticketList.filter(t => t.status === 'ACTIVE').length;
    const paidTickets = ticketList.filter(t => t.status === 'PAID').length;
    const totalRevenue = ticketList.reduce((acc, t) => acc + (t.total_paid || 0), 0);
    const outstandingFines = ticketList
      .filter(t => t.status === 'ACTIVE')
      .reduce((acc, t) => acc + (t.fine_amount || 0), 0);

    return {
      success: true,
      stats: {
        totalSlots,
        availableSlots,
        reservedSlots,
        occupiedSlots,
        occupancyRate,
        totalTicketsIssued,
        activeTickets,
        paidTickets,
        totalRevenue,
        outstandingFines,
        totalViolationsCount: state.violations.length
      },
      violations: state.violations.slice(0, 30)
    };
  }

  // POST /api/admin/reset
  if (path === '/api/admin/reset' && method === 'POST') {
    state.slots = initializeSlots();
    state.tickets = {};
    state.violations = [];
    saveState(state);
    return { success: true, message: 'Mall parking system successfully reset to baseline.' };
  }

  // POST /api/admin/time-warp
  if (path === '/api/admin/time-warp' && method === 'POST') {
    const sixteenMinsAgo = Date.now() - (16 * 60 * 1000);
    for (const s of state.slots) {
      if (s.status === 'RESERVED' && s.reserved_at) {
        s.reserved_at = sixteenMinsAgo;
      }
    }
    cleanExpired(state);
    saveState(state);
    return { success: true, message: 'Simulated time fast-forwarded by 16 minutes. Expired reservations reclaimed.' };
  }

  // POST /api/user/login
  if (path === '/api/user/login' && method === 'POST') {
    const body = options.body ? JSON.parse(options.body) : {};
    const { name, ticketId } = body;
    if (!name) return { success: false, error: 'Name is required.' };

    if (ticketId) {
      // Lookup existing ticket
      const cleanId = ticketId.trim().toUpperCase();
      const ticket = state.tickets[cleanId];
      if (!ticket) return { success: false, error: `Ticket "${cleanId}" not found. Please check the ID.` };
      if (ticket.status === 'PAID' || ticket.status === 'EXPIRED') {
        return { success: false, error: `Ticket "${cleanId}" has already been ${ticket.status.toLowerCase()}.` };
      }
      return { success: true, ticketId: cleanId, ticket };
    } else {
      // Issue a new ticket automatically
      const nearestSlot = getNearestSlot(state);
      if (!nearestSlot) return { success: false, error: 'Parking Full: No available slots.' };

      const newTicketId = generateTicketId();
      nearestSlot.status = 'RESERVED';
      nearestSlot.current_ticket_id = newTicketId;
      nearestSlot.reserved_at = now;

      state.tickets[newTicketId] = {
        id: newTicketId,
        entry_time: now,
        assigned_slot_id: nearestSlot.id,
        status: 'ACTIVE',
        fine_amount: 0,
        parked_time: null
      };

      let qrDataUrl = '';
      try {
        qrDataUrl = await QRCode.toDataURL(JSON.stringify({ type: 'TICKET', ticketId: newTicketId }), {
          errorCorrectionLevel: 'H', margin: 2, width: 280,
          color: { dark: '#0f172a', light: '#ffffff' }
        });
      } catch { /* ignore */ }

      saveState(state, 'TICKET_ISSUED');
      return {
        success: true,
        ticketId: newTicketId,
        ticket: state.tickets[newTicketId],
        slot: nearestSlot,
        qrDataUrl
      };
    }
  }

  // POST /api/admin/login
  if (path === '/api/admin/login' && method === 'POST') {
    const body = options.body ? JSON.parse(options.body) : {};
    const { userId, password } = body;
    const ADMIN_USER = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADMIN_USER) || 'admin';
    const ADMIN_PASS = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADMIN_PASS) || 'parkme123';
    if (userId === ADMIN_USER && password === ADMIN_PASS) {
      return { success: true, role: 'ADMIN' };
    }
    return { success: false, error: 'Invalid credentials.' };
  }

  return { success: false, error: `Endpoint not found: ${method} ${path}` };
}

/**
 * Setup transparent fetch interceptor:
 * If we are on GitHub Pages or if local backend fails to respond,
 * transparently fulfills /api calls with the client-side parking engine!
 */
export function setupMockBackendIfNeeded() {
  const isGitHubPages = typeof window !== 'undefined' && window.location.hostname.includes('github.io');
  const originalFetch = window.fetch;

  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';

    // If it's an API route:
    if (url.startsWith('/api') || url.includes('/api/')) {
      const cleanPath = url.startsWith('http') ? new URL(url).pathname : url;

      // If a deployed backend URL is configured, proxy all API calls there (real cross-device sync)
      if (BACKEND_URL) {
        try {
          const fullUrl = `${BACKEND_URL.replace(/\/$/, '')}${cleanPath}`;
          return await originalFetch(fullUrl, init);
        } catch {
          console.warn(`[ParkMe] Deployed backend unreachable. Falling back to in-browser engine.`);
        }
      }

      // On GitHub Pages, serve directly from the in-browser mock engine
      if (isGitHubPages) {
        const result = await handleMockApi(cleanPath, init);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Locally, attempt the real backend first; fallback to mock if offline
      try {
        const response = await originalFetch(input, init);
        if (response.status === 404) {
          const result = await handleMockApi(cleanPath, init);
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return response;
      } catch {
        console.warn(`[ParkMe] Backend not reachable. Falling back to in-browser engine.`);
        const result = await handleMockApi(cleanPath, init);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return originalFetch(input, init);
  };
}
