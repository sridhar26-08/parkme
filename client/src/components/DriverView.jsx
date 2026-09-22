import React, { useState, useEffect } from 'react';
import { Car, MapPin, Clock, AlertTriangle, CheckCircle2, QrCode, ShieldAlert, Sparkles, RefreshCw, Compass } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function DriverView({ activeTicketId, slots, onOpenScanner, onSelectTicket }) {
  const [ticketIdInput, setTicketIdInput] = useState(activeTicketId || '');
  const [ticketData, setTicketData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scanResult, setScanResult] = useState(null);

  // Poll ticket data
  const fetchTicket = async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tickets/${id.trim().toUpperCase()}`);
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Ticket not found');
      }
      setTicketData(data.ticket);
      setError(null);
    } catch (err) {
      setError(err.message);
      setTicketData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTicketId) {
      setTicketIdInput(activeTicketId);
      fetchTicket(activeTicketId);
    }
  }, [activeTicketId]);

  // Periodic refresh for reservation countdown
  useEffect(() => {
    if (!ticketIdInput) return;
    const interval = setInterval(() => {
      fetchTicket(ticketIdInput);
    }, 4000);
    return () => clearInterval(interval);
  }, [ticketIdInput]);

  // Handle direct slot park simulation (or when scanner returns)
  const handleParkAtSlot = async (slotIdToScan) => {
    if (!ticketIdInput) return;
    setLoading(true);
    setScanResult(null);
    try {
      const res = await fetch('/api/park/scan-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticketIdInput.trim().toUpperCase(),
          slotId: slotIdToScan
        })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Parking scan failed');
      }

      setScanResult(data);
      if (data.match) {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 }
        });
      }
      // Refresh ticket details
      fetchTicket(ticketIdInput);
    } catch (err) {
      alert(`Error scanning slot: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatTimer = (seconds) => {
    if (!seconds || seconds <= 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Compute progress for 15 minute timer
  const totalWindow = 15 * 60;
  const remaining = ticketData?.remainingReservationSeconds || 0;
  const progressPercent = Math.max(0, Math.min(100, (remaining / totalWindow) * 100));

  // Find all active tickets in system to provide quick picker
  const activeTicketsInSlots = slots
    .filter(s => s.current_ticket_id)
    .map(s => ({ ticketId: s.current_ticket_id, slotId: s.id, status: s.status }));

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto' }}>
      {/* Driver companion header & ticket selector */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Car size={24} color="#6366f1" /> Driver Companion
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Scan your ticket QR or enter ticket ID to view assigned bay & check in
            </p>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fetchTicket(ticketIdInput)}
            disabled={loading || !ticketIdInput}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Status
          </button>
        </div>

        {/* Input bar */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="e.g. TKT-ABC123"
            value={ticketIdInput}
            onChange={(e) => setTicketIdInput(e.target.value.toUpperCase())}
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '0.65rem 1rem',
              borderRadius: '12px',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid var(--border-subtle)',
              color: '#fff',
              fontFamily: 'var(--font-mono)',
              fontSize: '1rem',
              fontWeight: 600,
              outline: 'none'
            }}
          />
          <button
            className="btn btn-primary"
            onClick={() => {
              if (onSelectTicket) onSelectTicket(ticketIdInput);
              fetchTicket(ticketIdInput);
            }}
            disabled={!ticketIdInput || loading}
          >
            Load Ticket
          </button>
        </div>

        {/* Quick select from active system tickets */}
        {activeTicketsInSlots.length > 0 && (
          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span style={{ marginRight: '0.5rem' }}>Quick select active ticket:</span>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
              {activeTicketsInSlots.map(t => (
                <button
                  key={t.ticketId}
                  onClick={() => {
                    setTicketIdInput(t.ticketId);
                    if (onSelectTicket) onSelectTicket(t.ticketId);
                    fetchTicket(t.ticketId);
                  }}
                  style={{
                    background: ticketIdInput === t.ticketId ? 'rgba(99, 102, 241, 0.25)' : 'rgba(30, 41, 59, 0.6)',
                    border: '1px solid',
                    borderColor: ticketIdInput === t.ticketId ? 'var(--accent-primary)' : 'var(--border-subtle)',
                    color: ticketIdInput === t.ticketId ? '#fff' : 'var(--text-secondary)',
                    borderRadius: '8px',
                    padding: '0.25rem 0.6rem',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.76rem',
                    cursor: 'pointer'
                  }}
                >
                  {t.ticketId} ({t.slotId} - {t.status})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--status-occ-border)', color: '#f87171', padding: '0.85rem 1rem', borderRadius: '14px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {/* Ticket Details */}
      {ticketData && (
        <div>
          {/* Result Banner if scanned recently */}
          {scanResult && (
            <div style={{
              background: scanResult.match ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${scanResult.match ? 'var(--status-avail-border)' : 'var(--status-occ-border)'}`,
              borderRadius: '14px',
              padding: '1.1rem',
              marginBottom: '1.5rem',
              animation: scanResult.match ? 'none' : 'shake 0.5s ease-in-out'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                {scanResult.match ? (
                  <CheckCircle2 size={20} color="var(--status-avail)" />
                ) : (
                  <ShieldAlert size={20} color="var(--status-occ)" />
                )}
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: scanResult.match ? 'var(--status-avail)' : 'var(--status-occ)' }}>
                  {scanResult.match ? 'Slot Verified & Occupied' : 'Unauthorized Slot Violation!'}
                </h4>
              </div>
              <p style={{ fontSize: '0.88rem', color: scanResult.match ? '#a7f3d0' : '#fca5a5' }}>
                {scanResult.message}
              </p>
              {scanResult.victimTicketId && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#fecaca', background: 'rgba(0,0,0,0.2)', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
                  ℹ️ System auto-reassigned displaced driver ({scanResult.victimTicketId}) to Bay {scanResult.victimReassignedSlotId}.
                </div>
              )}
            </div>
          )}

          {/* Active Assigned Bay Card */}
          <div className="card" style={{ marginBottom: '1.5rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: ticketData.slot_status === 'OCCUPIED'
                ? 'var(--status-occ)'
                : 'linear-gradient(90deg, #f59e0b, #6366f1)'
            }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.4)', marginBottom: '0.5rem' }}>
                  Active Ticket #{ticketData.id}
                </span>
                <h3 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff' }}>
                  Bay {ticketData.assigned_slot_id || 'Pending Reassignment'}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <Compass size={15} color="#06b6d4" /> Floor {ticketData.floor || 'B1'} • Near Entrance Ramp A
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span className={`badge badge-${ticketData.slot_status ? ticketData.slot_status.toLowerCase() : 'reserved'}`}>
                  <span className="badge-dot" /> {ticketData.slot_status === 'OCCUPIED' ? 'PARKED & OCCUPIED' : 'RESERVED FOR YOU'}
                </span>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  Entry: {new Date(ticketData.entry_time).toLocaleTimeString()}
                </div>
              </div>
            </div>

            {/* Countdown timer if RESERVED */}
            {ticketData.slot_status === 'RESERVED' && (
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--border-subtle)', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Clock size={15} color="var(--status-res)" /> 15-Minute Reservation Window:
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--status-res)' }}>
                    {formatTimer(ticketData.remainingReservationSeconds)}
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${progressPercent}%`,
                    height: '100%',
                    background: progressPercent > 30 ? 'linear-gradient(90deg, #f59e0b, #10b981)' : 'var(--status-occ)',
                    borderRadius: '999px',
                    transition: 'width 1s linear'
                  }} />
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                  Please park in Bay {ticketData.assigned_slot_id} and scan the bay's QR code before the timer expires.
                </div>
              </div>
            )}

            {/* Occupied badge if already parked */}
            {ticketData.slot_status === 'OCCUPIED' && (
              <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid var(--status-avail-border)', padding: '0.85rem 1rem', borderRadius: '14px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <CheckCircle2 size={20} color="var(--status-avail)" />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--status-avail)', fontSize: '0.9rem' }}>
                    Successfully Parked & Checked In
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#a7f3d0' }}>
                    Parked at: {ticketData.parked_time ? new Date(ticketData.parked_time).toLocaleTimeString() : 'Just now'}. Head to exit gate when ready to leave!
                  </div>
                </div>
              </div>
            )}

            {/* Fines Banner if any */}
            {ticketData.fine_amount > 0 && (
              <div className="violation-banner">
                <ShieldAlert size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4>Violation Penalties: ${ticketData.fine_amount.toFixed(2)}</h4>
                  <p>
                    A penalty was applied because your vehicle parked in an unassigned/unauthorized bay.
                    This penalty will be added at checkout.
                  </p>
                </div>
              </div>
            )}

            {/* Parking Action Buttons */}
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginBottom: '0.6rem' }}>
                Driver Actions:
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {/* Real Camera Scanner */}
                <button
                  className="btn btn-primary"
                  onClick={() => onOpenScanner({ mode: 'SLOT', ticketId: ticketData.id })}
                >
                  <QrCode size={16} /> Open Camera QR Scanner
                </button>

                {/* Quick 1-click test simulation buttons */}
                <button
                  className="btn btn-success"
                  onClick={() => handleParkAtSlot(ticketData.assigned_slot_id)}
                  disabled={ticketData.slot_status === 'OCCUPIED'}
                >
                  <CheckCircle2 size={16} /> Simulate Correct Bay ({ticketData.assigned_slot_id})
                </button>

                {/* Conflict test button: park in someone else's slot! */}
                {slots.find(s => s.id !== ticketData.assigned_slot_id) && (
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      const wrongSlot = slots.find(s => s.id !== ticketData.assigned_slot_id)?.id;
                      if (wrongSlot) handleParkAtSlot(wrongSlot);
                    }}
                    title="Simulate parking in another bay to test conflict resolution, fines, and auto-reassignment"
                  >
                    <AlertTriangle size={16} /> Simulate Wrong Bay (Test Fine & Reassign)
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Violations History Table */}
          {ticketData.violations && ticketData.violations.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div className="card-title" style={{ fontSize: '1rem', color: '#f87171' }}>
                  <ShieldAlert size={18} /> Recorded Parking Infractions
                </div>
              </div>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Infraction Bay</th>
                      <th>Fine</th>
                      <th>Status</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ticketData.violations.map(v => (
                      <tr key={v.id}>
                        <td>{new Date(v.timestamp).toLocaleTimeString()}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{v.slot_id}</td>
                        <td style={{ color: '#f87171', fontWeight: 700 }}>${v.fine_amount.toFixed(2)}</td>
                        <td>
                          <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: v.fine_status === 'PAID' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: v.fine_status === 'PAID' ? 'var(--status-avail)' : '#f87171' }}>
                            {v.fine_status}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{v.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
