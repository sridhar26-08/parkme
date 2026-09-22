const express = require('express');
const cors = require('cors');
const parkingRoutes = require('./routes/parking');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api', parkingRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'QR Mall Parking API', timestamp: Date.now() });
});

// Periodic cleanup of expired reservations (every 30 seconds)
setInterval(() => {
  try {
    const now = Date.now();
    const expiryCutoff = now - (15 * 60 * 1000);
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
      console.log(`[ExpiryWorker] Reclaimed ${expiredSlots.length} expired slot reservation(s).`);
    }
  } catch (err) {
    console.error('[ExpiryWorker] Error running reservation cleanup:', err);
  }
}, 30000);

app.listen(PORT, () => {
  console.log(`🚀 Mall Parking Slot System Backend running at http://localhost:${PORT}`);
});
