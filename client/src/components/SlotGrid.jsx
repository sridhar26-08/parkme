import React, { useState } from 'react';
import { Layers, QrCode, Clock, CheckCircle2, AlertTriangle, Car, ShieldAlert, Sparkles } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function SlotGrid({ slots, onSelectSlot, onRefresh }) {
  const [selectedFloor, setSelectedFloor] = useState('B1');
  const [selectedQrSlot, setSelectedQrSlot] = useState(null);

  const floors = [
    { id: 'B1', name: 'Basement 1 (Express / Nearest)' },
    { id: 'B2', name: 'Basement 2' },
    { id: 'F1', name: 'Floor 1 (Rooftop / Level 1)' }
  ];

  const currentFloorSlots = slots.filter(s => s.floor === selectedFloor);

  const stats = {
    total: currentFloorSlots.length,
    available: currentFloorSlots.filter(s => s.status === 'AVAILABLE').length,
    reserved: currentFloorSlots.filter(s => s.status === 'RESERVED').length,
    occupied: currentFloorSlots.filter(s => s.status === 'OCCUPIED').length,
  };

  const formatTimer = (seconds) => {
    if (!seconds || seconds <= 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div>
      {/* Floor navigation & summary header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Layers size={22} color="#6366f1" /> Mall Parking Floor View
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Live bay sensor grid with auto-assignment & physical QR matching
          </p>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', background: 'rgba(15, 23, 42, 0.6)', padding: '0.4rem 0.8rem', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
          <span className="badge badge-available"><span className="badge-dot" /> Available ({slots.filter(s => s.status === 'AVAILABLE').length})</span>
          <span className="badge badge-reserved"><span className="badge-dot" /> Reserved ({slots.filter(s => s.status === 'RESERVED').length})</span>
          <span className="badge badge-occupied"><span className="badge-dot" /> Occupied ({slots.filter(s => s.status === 'OCCUPIED').length})</span>
        </div>
      </div>

      {/* Floor tabs */}
      <div className="floor-selector">
        {floors.map(fl => {
          const flSlots = slots.filter(s => s.floor === fl.id);
          const avail = flSlots.filter(s => s.status === 'AVAILABLE').length;
          return (
            <button
              key={fl.id}
              className={`floor-btn ${selectedFloor === fl.id ? 'active' : ''}`}
              onClick={() => setSelectedFloor(fl.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>{fl.name}</span>
                <span style={{
                  fontSize: '0.75rem',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '6px',
                  background: avail > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: avail > 0 ? 'var(--status-avail)' : 'var(--status-occ)',
                  fontWeight: 700
                }}>
                  {avail} free
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Slots grid */}
      <div className="slots-grid">
        {currentFloorSlots.map(slot => {
          const isAvail = slot.status === 'AVAILABLE';
          const isRes = slot.status === 'RESERVED';
          const isOcc = slot.status === 'OCCUPIED';

          return (
            <div
              key={slot.id}
              className={`slot-card ${slot.status.toLowerCase()}`}
              onClick={() => setSelectedQrSlot(slot)}
              title="Click to view slot's physical QR Code"
            >
              <div className="slot-top">
                <div>
                  <div className="slot-id-badge">{slot.id}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Floor {slot.floor} • Bay #{slot.slot_number}</div>
                </div>

                <span className={`badge badge-${slot.status.toLowerCase()}`}>
                  <span className="badge-dot" /> {slot.status}
                </span>
              </div>

              {/* Status details */}
              <div style={{ marginTop: '0.75rem' }}>
                {isAvail && (
                  <div style={{ color: 'var(--status-avail)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <CheckCircle2 size={14} /> Ready for reservation
                  </div>
                )}

                {isRes && (
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Ticket: <span style={{ fontFamily: 'var(--font-mono)', color: '#fff', fontWeight: 600 }}>{slot.current_ticket_id}</span>
                    </div>
                    <div className="slot-timer" style={{ marginTop: '0.2rem' }}>
                      <Clock size={13} /> Expires: {formatTimer(slot.remainingReservationSeconds)}
                    </div>
                  </div>
                )}

                {isOcc && (
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Parked Ticket: <span style={{ fontFamily: 'var(--font-mono)', color: '#fff', fontWeight: 600 }}>{slot.current_ticket_id}</span>
                    </div>
                    <div style={{ color: 'var(--status-occ)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem' }}>
                      <Car size={13} /> Vehicle in bay
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="slot-footer">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--accent-cyan)', fontSize: '0.75rem' }}>
                  <QrCode size={13} /> View QR
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Physical Pole</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal for Slot QR Inspection */}
      {selectedQrSlot && (
        <div className="modal-overlay" onClick={() => setSelectedQrSlot(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>
                Bay {selectedQrSlot.id} QR Code
              </h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedQrSlot(null)}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              This fixed QR code is permanently mounted on the physical parking slot pole. Drivers scan this when parking.
            </p>

            <div style={{
              background: '#ffffff',
              padding: '1.5rem',
              borderRadius: '16px',
              display: 'inline-block',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              margin: '0 auto 1.25rem'
            }}>
              <QRCodeSVG
                value={JSON.stringify({ type: 'SLOT', slotId: selectedQrSlot.id })}
                size={200}
                level="H"
                includeMargin={true}
              />
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.1rem', color: '#0f172a', marginTop: '0.5rem' }}>
                BAY: {selectedQrSlot.id}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Floor {selectedQrSlot.floor} • Mall Parking
              </div>
            </div>

            <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '0.85rem', borderRadius: '12px', fontSize: '0.8rem', textAlign: 'left', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Current Status:</span>
                <span className={`badge badge-${selectedQrSlot.status.toLowerCase()}`}>
                  <span className="badge-dot" /> {selectedQrSlot.status}
                </span>
              </div>
              {selectedQrSlot.current_ticket_id && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Linked Ticket:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#fff' }}>{selectedQrSlot.current_ticket_id}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  navigator.clipboard.writeText(selectedQrSlot.id);
                  alert(`Copied slot ID ${selectedQrSlot.id} to clipboard!`);
                }}
              >
                Copy Slot ID ({selectedQrSlot.id})
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedQrSlot(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
