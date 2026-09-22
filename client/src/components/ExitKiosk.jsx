import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle2, AlertTriangle, ShieldAlert, Clock, Receipt, Sparkles, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ExitKiosk({ defaultTicketId, slots, onPaymentComplete }) {
  const [ticketId, setTicketId] = useState(defaultTicketId || '');
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paidReceipt, setPaidReceipt] = useState(null);

  useEffect(() => {
    if (defaultTicketId) {
      setTicketId(defaultTicketId);
      fetchQuote(defaultTicketId);
    }
  }, [defaultTicketId]);

  const fetchQuote = async (id) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setPaidReceipt(null);
    try {
      const res = await fetch(`/api/exit/quote/${id.trim().toUpperCase()}`);
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch exit quote');
      }
      setQuote(data);
    } catch (err) {
      setError(err.message);
      setQuote(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePayAndExit = async (paymentMethod = 'CREDIT_CARD') => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/exit/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: ticketId.trim().toUpperCase(), paymentMethod })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Payment failed');
      }

      setPaidReceipt(data.receipt);
      setQuote(null);
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.5 }
      });

      if (onPaymentComplete) {
        onPaymentComplete(data.receipt);
      }
    } catch (err) {
      alert(`Payment error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Find active parked tickets for quick testing
  const activeTickets = slots.filter(s => s.current_ticket_id).map(s => s.current_ticket_id);

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto' }}>
      {/* Exit Gate Header */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <CreditCard size={24} color="#6366f1" /> Mall Exit Gate & Cashier
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Scan ticket QR or enter ticket number to compute stay duration & clear payment
            </p>
          </div>
        </div>

        {/* Input bar */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Scan or enter Ticket ID (e.g. TKT-ABC123)"
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value.toUpperCase())}
            style={{
              flex: 1,
              minWidth: '220px',
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
            onClick={() => fetchQuote(ticketId)}
            disabled={!ticketId || loading}
          >
            Calculate Fee
          </button>
        </div>

        {/* Active tickets quick selector */}
        {activeTickets.length > 0 && (
          <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span>Quick select active vehicle:</span>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
              {activeTickets.map(t => (
                <button
                  key={t}
                  onClick={() => {
                    setTicketId(t);
                    fetchQuote(t);
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--status-occ-border)', color: '#f87171', padding: '0.85rem 1rem', borderRadius: '14px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {/* Quote Breakdown Card */}
      {quote && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <div>
              <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.4)', marginBottom: '0.4rem' }}>
                Exit Clearance Quote
              </span>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>
                Ticket #{quote.ticketId}
              </h3>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Parked In Bay</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: '#06b6d4' }}>
                {quote.assignedSlotId}
              </div>
            </div>
          </div>

          {/* Itemized bill */}
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', borderRadius: '14px', border: '1px solid var(--border-subtle)', padding: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Clock size={15} /> Duration of Stay:
              </span>
              <span style={{ fontWeight: 600, color: '#fff' }}>
                {quote.durationMinutes} minute(s) ({quote.durationHours} billed hour{quote.durationHours > 1 ? 's' : ''})
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Base Parking Rate ($5 first hr + $3/hr):</span>
              <span style={{ fontWeight: 600, color: '#fff' }}>${quote.parkingFee.toFixed(2)}</span>
            </div>

            {quote.fineAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.9rem', color: '#f87171' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldAlert size={15} /> Unauthorized Parking Penalties:
                </span>
                <span style={{ fontWeight: 700 }}>+${quote.fineAmount.toFixed(2)}</span>
              </div>
            )}

            <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0.75rem 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.2rem', fontWeight: 800 }}>
              <span style={{ color: '#fff' }}>Total Amount Due:</span>
              <span style={{ color: '#10b981', fontSize: '1.4rem' }}>
                ${quote.totalAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Violations notice if any */}
          {quote.violations && quote.violations.length > 0 && (
            <div className="violation-banner">
              <ShieldAlert size={20} style={{ flexShrink: 0 }} />
              <div>
                <h4>Infraction Notice</h4>
                <p>
                  {quote.violations.map(v => v.reason).join('; ')}
                </p>
              </div>
            </div>
          )}

          {/* Payment actions */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-success"
              style={{ flex: 1, minWidth: '180px', padding: '0.8rem 1.25rem', fontSize: '1rem' }}
              onClick={() => handlePayAndExit('CREDIT_CARD')}
              disabled={loading}
            >
              <CreditCard size={18} /> Pay ${quote.totalAmount.toFixed(2)} & Raise Barrier
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 1, minWidth: '180px', padding: '0.8rem 1.25rem', fontSize: '1rem' }}
              onClick={() => handlePayAndExit('APPLE_PAY')}
              disabled={loading}
            >
              <Sparkles size={18} /> Apple Pay / Fast Checkout
            </button>
          </div>
        </div>
      )}

      {/* Paid Receipt Confirmation */}
      {paidReceipt && (
        <div className="ticket-paper" style={{ animation: 'fadeIn 0.4s ease-out' }}>
          <div style={{ textAlign: 'center', borderBottom: '2px dashed #cbd5e1', paddingBottom: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'inline-flex', padding: '0.5rem', borderRadius: '50%', background: '#dcfce7', color: '#15803d', marginBottom: '0.4rem' }}>
              <CheckCircle2 size={28} />
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>
              EXIT GATE OPENED
            </h3>
            <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
              Payment Settled & Bay Released
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '12px', fontSize: '0.82rem', color: '#334155', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span>Ticket Number:</span>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>{paidReceipt.ticketId}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span>Bay Freed to Available:</span>
              <strong style={{ color: '#16a34a' }}>{paidReceipt.freedSlotId || 'None'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span>Parking Fee:</span>
              <span>${paidReceipt.parkingFee.toFixed(2)}</span>
            </div>
            {paidReceipt.fineAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', color: '#dc2626' }}>
                <span>Fines Paid:</span>
                <span>${paidReceipt.fineAmount.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: '0.4rem', fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
              <span>Total Paid:</span>
              <span>${paidReceipt.totalPaid.toFixed(2)}</span>
            </div>
          </div>

          <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
            Safe travels! Have a wonderful day ahead.
          </p>

          <button
            className="btn btn-secondary"
            style={{ width: '100%', borderRadius: '10px', color: '#0f172a', background: '#e2e8f0', borderColor: '#cbd5e1' }}
            onClick={() => {
              setPaidReceipt(null);
              setTicketId('');
            }}
          >
            Process Next Vehicle
          </button>
        </div>
      )}
    </div>
  );
}
