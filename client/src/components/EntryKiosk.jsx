import React, { useState } from 'react';
import { Ticket, Sparkles, Car, Clock, ArrowRight, Printer, AlertCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function EntryKiosk({ onTicketCreated, onOpenDriverView }) {
  const [issuedTicket, setIssuedTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleIssueTicket = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/entry/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to issue ticket');
      }
      setIssuedTicket(data);
      if (onTicketCreated) onTicketCreated(data.ticket.ticketId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto' }}>
      <div className="card" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'inline-flex', padding: '0.9rem', borderRadius: '16px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', marginBottom: '1rem' }}>
          <Ticket size={36} />
        </div>

        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginBottom: '0.4rem' }}>
          Mall Entry Gate Kiosk
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '520px', margin: '0 auto 1.5rem' }}>
          Welcome to Grand Plaza Mall. Press the button below at the barrier to retrieve your QR Parking Ticket.
          Our smart system instantly reserves your nearest available bay.
        </p>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--status-occ-border)', color: '#f87171', padding: '0.75rem 1rem', borderRadius: '12px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <button
          className="btn btn-primary"
          style={{ padding: '0.85rem 2rem', fontSize: '1.05rem', borderRadius: '14px' }}
          onClick={handleIssueTicket}
          disabled={loading}
        >
          {loading ? (
            <span>Allocating Nearest Slot...</span>
          ) : (
            <>
              <Sparkles size={18} /> Press to Dispense Ticket
            </>
          )}
        </button>
      </div>

      {/* Issued Ticket Display */}
      {issuedTicket && (
        <div className="ticket-paper" style={{ animation: 'fadeIn 0.4s ease-out' }}>
          <div style={{ textAlign: 'center', borderBottom: '2px dashed #cbd5e1', paddingBottom: '1rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', fontWeight: 700 }}>
              Grand Plaza Mall Parking
            </div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0' }}>
              ENTRY TICKET
            </h3>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: '#4338ca', letterSpacing: '0.05em' }}>
              {issuedTicket.ticket.ticketId}
            </div>
          </div>

          <div style={{ background: '#f1f5f9', padding: '0.85rem', borderRadius: '12px', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.82rem', color: '#475569' }}>
              <span>Auto-Assigned Bay:</span>
              <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>
                Bay {issuedTicket.ticket.assignedSlot.id}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.82rem', color: '#475569' }}>
              <span>Floor Level:</span>
              <strong style={{ color: '#0f172a' }}>Floor {issuedTicket.ticket.assignedSlot.floor}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#475569' }}>
              <span>Status:</span>
              <span style={{ color: '#b45309', fontWeight: 700, background: '#fef3c7', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                RESERVED (15m window)
              </span>
            </div>
          </div>

          <div className="ticket-qr-container">
            <QRCodeSVG
              value={issuedTicket.qrPayload || JSON.stringify({ type: 'TICKET', ticketId: issuedTicket.ticket.ticketId })}
              size={180}
              level="H"
              includeMargin={true}
            />
          </div>

          <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#64748b', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', color: '#b45309', fontWeight: 600, marginBottom: '0.25rem' }}>
              <Clock size={13} /> Bay reservation holds for 15 minutes
            </div>
            Scan this QR code with your phone or proceed to Bay {issuedTicket.ticket.assignedSlot.id}.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <button
              className="btn btn-primary"
              style={{ width: '100%', borderRadius: '10px' }}
              onClick={() => onOpenDriverView(issuedTicket.ticket.ticketId)}
            >
              Open Driver Mobile Companion <ArrowRight size={16} />
            </button>
            <button
              className="btn btn-secondary"
              style={{ width: '100%', borderRadius: '10px', color: '#0f172a', background: '#e2e8f0', borderColor: '#cbd5e1' }}
              onClick={() => window.print()}
            >
              <Printer size={15} /> Print Physical Slip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
