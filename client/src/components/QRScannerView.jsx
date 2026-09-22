import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, RefreshCw, AlertCircle, CheckCircle2, QrCode, Sparkles, Smartphone } from 'lucide-react';

export default function QRScannerView({ slots, onScanSuccess, defaultTicketId }) {
  const [scannerMode, setScannerMode] = useState('SLOT'); // 'SLOT' or 'TICKET'
  const [activeTicketId, setActiveTicketId] = useState(defaultTicketId || '');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [lastScannedResult, setLastScannedResult] = useState(null);
  const [processing, setProcessing] = useState(false);

  const html5QrCodeRef = useRef(null);

  // Sync activeTicketId if prop changes
  useEffect(() => {
    if (defaultTicketId) setActiveTicketId(defaultTicketId);
  }, [defaultTicketId]);

  // Start Camera
  const startScanner = async () => {
    setCameraError(null);
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('qr-reader');
      }

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        (decodedText) => {
          handleDecodedText(decodedText);
        },
        (errorMessage) => {
          // Continuous frame scan error - expected while searching for QR
        }
      );
      setCameraActive(true);
    } catch (err) {
      console.warn('Camera start error:', err);
      setCameraError(
        'Unable to access camera. Please allow camera permissions, or use the interactive Quick Scan Simulator below.'
      );
      setCameraActive(false);
    }
  };

  // Stop Camera
  const stopScanner = async () => {
    if (html5QrCodeRef.current && cameraActive) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      setCameraActive(false);
    }
  };

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Parse QR content (supports JSON, prefixes, or raw IDs)
  const parsePayload = (text) => {
    try {
      const parsed = JSON.parse(text);
      if (parsed.type === 'SLOT') return { type: 'SLOT', value: parsed.slotId };
      if (parsed.type === 'TICKET') return { type: 'TICKET', value: parsed.ticketId };
    } catch (e) {
      // Not json, check string prefixes
      if (text.startsWith('SLOT:')) return { type: 'SLOT', value: text.replace('SLOT:', '').trim() };
      if (text.startsWith('TICKET:')) return { type: 'TICKET', value: text.replace('TICKET:', '').trim() };
      if (text.startsWith('TKT-')) return { type: 'TICKET', value: text.trim() };
      if (text.includes('-')) return { type: 'SLOT', value: text.trim() };
    }
    return { type: scannerMode, value: text.trim() };
  };

  const handleDecodedText = (text) => {
    const parsed = parsePayload(text);
    setLastScannedResult({ raw: text, parsed });

    if (onScanSuccess) {
      onScanSuccess({
        mode: scannerMode,
        activeTicketId,
        parsedValue: parsed.value,
        type: parsed.type
      });
    }
  };

  // Simulation handler for instant testing without webcam
  const handleSimulateScan = (value, type) => {
    handleDecodedText(JSON.stringify({ type, [type === 'SLOT' ? 'slotId' : 'ticketId']: value }));
  };

  // Active tickets in system
  const activeTickets = slots.filter(s => s.current_ticket_id).map(s => s.current_ticket_id);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Camera size={22} color="#6366f1" /> Camera QR Scanner
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Scan physical pole QR codes at parking bays or entry/exit ticket slips
            </p>
          </div>

          {/* Scanner Mode selector */}
          <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.7)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => setScannerMode('SLOT')}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                border: 'none',
                background: scannerMode === 'SLOT' ? 'var(--accent-primary)' : 'transparent',
                color: scannerMode === 'SLOT' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              Scan Slot QR (Bay Pole)
            </button>
            <button
              onClick={() => setScannerMode('TICKET')}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                border: 'none',
                background: scannerMode === 'TICKET' ? 'var(--accent-primary)' : 'transparent',
                color: scannerMode === 'TICKET' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              Scan Ticket QR (Exit/Driver)
            </button>
          </div>
        </div>

        {/* If in Slot mode, let driver specify their ticket */}
        {scannerMode === 'SLOT' && (
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid var(--border-subtle)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Scanning as Driver with Ticket:
            </span>
            <input
              type="text"
              placeholder="e.g. TKT-ABC123"
              value={activeTicketId}
              onChange={(e) => setActiveTicketId(e.target.value.toUpperCase())}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                background: '#0f172a',
                border: '1px solid var(--border-light)',
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.88rem',
                fontWeight: 600
              }}
            />
            {activeTickets.length > 0 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                (Found {activeTickets.length} active ticket in lot)
              </span>
            )}
          </div>
        )}

        {/* Camera Feed Container */}
        <div style={{ position: 'relative', background: '#020617', borderRadius: '16px', overflow: 'hidden', minHeight: '320px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div id="qr-reader" style={{ width: '100%', maxWidth: '380px' }} />

          {!cameraActive && (
            <div style={{ textAlign: 'center', padding: '1.5rem' }}>
              <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', marginBottom: '1rem' }}>
                <Camera size={40} />
              </div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '0.3rem' }}>
                Camera Scanner Ready
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '340px', margin: '0 auto 1.25rem' }}>
                Point your mobile camera or webcam at a printed parking bay QR code or mobile screen ticket.
              </p>
              <button
                className="btn btn-primary"
                onClick={startScanner}
              >
                <Camera size={16} /> Activate Camera
              </button>
            </div>
          )}

          {cameraActive && (
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-danger btn-sm" onClick={stopScanner}>
                Stop Camera
              </button>
            </div>
          )}
        </div>

        {cameraError && (
          <div style={{ marginTop: '1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--status-occ-border)', color: '#f87171', padding: '0.75rem 1rem', borderRadius: '12px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} /> {cameraError}
          </div>
        )}

        {/* Last scanned banner */}
        {lastScannedResult && (
          <div style={{ marginTop: '1.25rem', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid var(--status-avail-border)', padding: '0.85rem 1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <CheckCircle2 size={18} color="var(--status-avail)" />
            <div style={{ fontSize: '0.85rem' }}>
              <strong style={{ color: 'var(--status-avail)' }}>Scanned QR:</strong> {lastScannedResult.parsed.type} ID:{' '}
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#fff' }}>
                {lastScannedResult.parsed.value}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Simulator Quick Testing Bar (Zero-friction testing on laptops without physical cameras!) */}
      <div className="card" style={{ background: 'rgba(30, 41, 59, 0.4)' }}>
        <div className="card-header">
          <div className="card-title" style={{ fontSize: '1.05rem', color: '#38bdf8' }}>
            <Sparkles size={18} /> Instant QR Simulator (Test Without Webcam)
          </div>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Select any physical parking bay or active driver ticket below to simulate scanning its QR code instantly:
        </p>

        {/* Quick Slot selector */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>
            SIMULATE SCANNING BAY QR (Driver checking in at pole):
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(85px, 1fr))', gap: '0.4rem' }}>
            {slots.slice(0, 16).map(slot => (
              <button
                key={slot.id}
                onClick={() => handleSimulateScan(slot.id, 'SLOT')}
                style={{
                  padding: '0.4rem 0.5rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  background: slot.status === 'AVAILABLE' ? 'rgba(16, 185, 129, 0.15)' : slot.status === 'RESERVED' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: slot.status === 'AVAILABLE' ? 'var(--status-avail)' : slot.status === 'RESERVED' ? 'var(--status-res)' : '#f87171',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {slot.id}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Ticket selector */}
        {activeTickets.length > 0 && (
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>
              SIMULATE SCANNING TICKET QR (Exit gate checkout):
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {activeTickets.map(tId => (
                <button
                  key={tId}
                  onClick={() => handleSimulateScan(tId, 'TICKET')}
                  className="btn btn-secondary btn-sm"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem' }}
                >
                  <QrCode size={13} /> {tId}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
