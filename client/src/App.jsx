import React, { useState, useEffect } from 'react';
import { Layers, Camera, Car, Ticket, CreditCard, BarChart3, QrCode, RefreshCw, Bell, ShieldAlert, Sparkles } from 'lucide-react';
import SlotGrid from './components/SlotGrid';
import EntryKiosk from './components/EntryKiosk';
import DriverView from './components/DriverView';
import QRScannerView from './components/QRScannerView';
import ExitKiosk from './components/ExitKiosk';
import AdminDashboard from './components/AdminDashboard';

export default function App() {
  const [activeTab, setActiveTab] = useState('GRID'); // 'GRID', 'DRIVER', 'SCANNER', 'ENTRY', 'EXIT', 'ADMIN'
  const [slots, setSlots] = useState([]);
  const [activeTicketId, setActiveTicketId] = useState('');
  const [scannerParams, setScannerParams] = useState(null);
  const [notification, setNotification] = useState(null);

  // Fetch slots
  const fetchSlots = async () => {
    try {
      const res = await fetch('/api/slots');
      const data = await res.json();
      if (data.success) {
        setSlots(data.slots);
      }
    } catch (err) {
      console.error('Failed to fetch parking slots:', err);
    }
  };

  useEffect(() => {
    fetchSlots();
    const interval = setInterval(fetchSlots, 3500);
    return () => clearInterval(interval);
  }, []);

  // Show banner alert helper
  const triggerNotification = (msg, type = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // When a ticket is created at Entry Kiosk
  const handleTicketCreated = (ticketId) => {
    setActiveTicketId(ticketId);
    fetchSlots();
    triggerNotification(`Ticket #${ticketId} created! Bay reserved.`, 'success');
  };

  // Open driver view for a ticket
  const handleOpenDriverView = (ticketId) => {
    setActiveTicketId(ticketId);
    setActiveTab('DRIVER');
  };

  // Open scanner modal / view
  const handleOpenScanner = (params) => {
    setScannerParams(params);
    setActiveTab('SCANNER');
  };

  // Handle successful QR scan from camera or simulator
  const handleScanSuccess = async ({ mode, activeTicketId: scannerTicketId, parsedValue, type }) => {
    const currentTicket = scannerTicketId || activeTicketId;

    if (type === 'SLOT' || mode === 'SLOT') {
      if (!currentTicket) {
        alert(`Scanned Slot ${parsedValue}. Please enter or select your Ticket ID first to park!`);
        setActiveTab('DRIVER');
        return;
      }

      // Check in vehicle
      try {
        const res = await fetch('/api/park/scan-slot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticketId: currentTicket, slotId: parsedValue })
        });
        const data = await res.json();
        if (!data.success) {
          alert(`Scan failed: ${data.error}`);
          return;
        }

        fetchSlots();
        setActiveTab('DRIVER');
        if (data.match) {
          triggerNotification(`Bay ${parsedValue} successfully verified and occupied!`, 'success');
        } else {
          triggerNotification(`Unauthorized Bay! ${data.message}`, 'error');
        }
      } catch (err) {
        alert(err.message);
      }
    } else if (type === 'TICKET' || mode === 'TICKET') {
      // Switch to exit kiosk or driver view
      setActiveTicketId(parsedValue);
      setActiveTab('EXIT');
      triggerNotification(`Ticket ${parsedValue} loaded at Exit Gate.`, 'info');
    }
  };

  // Compute live counts
  const availableCount = slots.filter(s => s.status === 'AVAILABLE').length;
  const reservedCount = slots.filter(s => s.status === 'RESERVED').length;
  const occupiedCount = slots.filter(s => s.status === 'OCCUPIED').length;

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="app-header">
        <div className="brand" onClick={() => setActiveTab('GRID')} style={{ cursor: 'pointer' }}>
          <div className="brand-icon-wrapper">
            <Car size={22} color="#ffffff" />
          </div>
          <div className="brand-text">
            <h1>PARKME MALL</h1>
            <p>Smart QR Parking System</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="nav-tabs">
          <button
            className={`nav-tab ${activeTab === 'GRID' ? 'active' : ''}`}
            onClick={() => setActiveTab('GRID')}
          >
            <Layers size={16} /> Slot Availability
          </button>

          <button
            className={`nav-tab ${activeTab === 'ENTRY' ? 'active' : ''}`}
            onClick={() => setActiveTab('ENTRY')}
          >
            <Ticket size={16} /> Entry Kiosk
          </button>

          <button
            className={`nav-tab ${activeTab === 'DRIVER' ? 'active' : ''}`}
            onClick={() => setActiveTab('DRIVER')}
          >
            <Car size={16} /> Driver Mobile
            {activeTicketId && (
              <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-mono)' }}>
                {activeTicketId.slice(-4)}
              </span>
            )}
          </button>

          <button
            className={`nav-tab ${activeTab === 'SCANNER' ? 'active' : ''}`}
            onClick={() => setActiveTab('SCANNER')}
          >
            <Camera size={16} /> QR Scanner
          </button>

          <button
            className={`nav-tab ${activeTab === 'EXIT' ? 'active' : ''}`}
            onClick={() => setActiveTab('EXIT')}
          >
            <CreditCard size={16} /> Exit & Pay
          </button>

          <button
            className={`nav-tab ${activeTab === 'ADMIN' ? 'active' : ''}`}
            onClick={() => setActiveTab('ADMIN')}
          >
            <BarChart3 size={16} /> Admin View
          </button>
        </nav>

        {/* Quick status pill */}
        <div className="header-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(15, 23, 42, 0.6)', padding: '0.35rem 0.75rem', borderRadius: '10px', border: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--status-avail)', fontWeight: 700 }}>{availableCount} Free</span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ color: 'var(--status-occ)', fontWeight: 700 }}>{occupiedCount} Parked</span>
          </div>
        </div>
      </header>

      {/* Global Notification Toast */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '75px',
          right: '20px',
          zIndex: 1000,
          background: notification.type === 'error' ? 'rgba(239, 68, 68, 0.92)' : notification.type === 'success' ? 'rgba(16, 185, 129, 0.92)' : 'rgba(99, 102, 241, 0.92)',
          color: '#fff',
          padding: '0.75rem 1.25rem',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          fontSize: '0.88rem',
          fontWeight: 600,
          animation: 'fadeIn 0.3s ease-out'
        }}>
          {notification.type === 'error' ? <ShieldAlert size={18} /> : <Sparkles size={18} />}
          {notification.msg}
        </div>
      )}

      {/* Main Content Render */}
      <main className="main-content">
        {activeTab === 'GRID' && (
          <SlotGrid
            slots={slots}
            onSelectSlot={(slot) => {
              if (slot.current_ticket_id) {
                setActiveTicketId(slot.current_ticket_id);
                setActiveTab('DRIVER');
              }
            }}
            onRefresh={fetchSlots}
          />
        )}

        {activeTab === 'ENTRY' && (
          <EntryKiosk
            onTicketCreated={handleTicketCreated}
            onOpenDriverView={handleOpenDriverView}
          />
        )}

        {activeTab === 'DRIVER' && (
          <DriverView
            activeTicketId={activeTicketId}
            slots={slots}
            onSelectTicket={(tkt) => setActiveTicketId(tkt)}
            onOpenScanner={(params) => {
              setScannerParams(params);
              setActiveTab('SCANNER');
            }}
          />
        )}

        {activeTab === 'SCANNER' && (
          <QRScannerView
            slots={slots}
            defaultTicketId={activeTicketId}
            onScanSuccess={handleScanSuccess}
          />
        )}

        {activeTab === 'EXIT' && (
          <ExitKiosk
            defaultTicketId={activeTicketId}
            slots={slots}
            onPaymentComplete={() => {
              fetchSlots();
              triggerNotification('Exit payment settled! Bay freed to Available.', 'success');
            }}
          />
        )}

        {activeTab === 'ADMIN' && (
          <AdminDashboard
            slots={slots}
            onRefreshData={fetchSlots}
          />
        )}
      </main>
    </div>
  );
}
