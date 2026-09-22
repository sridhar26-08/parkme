import React, { useState, useEffect } from 'react';
import { Layers, Camera, Car, Ticket, CreditCard, BarChart3, ShieldAlert, Sparkles, LogOut, User } from 'lucide-react';
import SlotGrid from './components/SlotGrid';
import EntryKiosk from './components/EntryKiosk';
import DriverView from './components/DriverView';
import QRScannerView from './components/QRScannerView';
import ExitKiosk from './components/ExitKiosk';
import AdminDashboard from './components/AdminDashboard';
import LoginScreen from './components/LoginScreen';
import { onStateChange } from './api/syncChannel';

export default function App() {
  const [session, setSession] = useState(() => {
    try {
      const saved = sessionStorage.getItem('parkme_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = sessionStorage.getItem('parkme_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.role === 'USER') return 'DRIVER';
      }
    } catch {}
    return 'GRID';
  });
  const [slots, setSlots] = useState([]);
  const [activeTicketId, setActiveTicketId] = useState(() => {
    try {
      const saved = sessionStorage.getItem('parkme_session');
      if (saved) return JSON.parse(saved).ticketId || '';
    } catch {}
    return '';
  });
  const [scannerParams, setScannerParams] = useState(null);
  const [notification, setNotification] = useState(null);

  // Fetch slots from server (or mock backend)
  const fetchSlots = async () => {
    try {
      const res = await fetch('/api/slots');
      const data = await res.json();
      if (data.success) setSlots(data.slots);
    } catch (err) {
      console.error('Failed to fetch parking slots:', err);
    }
  };

  // Poll slots every 3.5 seconds
  useEffect(() => {
    fetchSlots();
    const interval = setInterval(fetchSlots, 3500);
    return () => clearInterval(interval);
  }, []);

  // Listen to BroadcastChannel — refresh instantly when another tab changes state
  useEffect(() => {
    const unsub = onStateChange(() => {
      fetchSlots();
    });
    return unsub;
  }, []);

  const triggerNotification = (msg, type = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleLogin = (sessionData) => {
    setSession(sessionData);
    try {
      sessionStorage.setItem('parkme_session', JSON.stringify(sessionData));
    } catch {}
    if (sessionData.role === 'USER') {
      setActiveTicketId(sessionData.ticketId || '');
      setActiveTab('DRIVER');
    } else {
      setActiveTab('GRID');
    }
  };

  const handleLogout = () => {
    setSession(null);
    try {
      sessionStorage.removeItem('parkme_session');
    } catch {}
    setActiveTicketId('');
    setActiveTab('GRID');
  };

  const handleTicketCreated = (ticketId) => {
    setActiveTicketId(ticketId);
    fetchSlots();
    triggerNotification(`Ticket #${ticketId} created! Bay reserved.`, 'success');
  };

  const handleOpenDriverView = (ticketId) => {
    setActiveTicketId(ticketId);
    setActiveTab('DRIVER');
  };

  const handleScanSuccess = async ({ mode, activeTicketId: scannerTicketId, parsedValue, type }) => {
    const currentTicket = scannerTicketId || activeTicketId;

    if (type === 'SLOT' || mode === 'SLOT') {
      if (!currentTicket) {
        alert(`Scanned Slot ${parsedValue}. Please enter or select your Ticket ID first to park!`);
        setActiveTab('DRIVER');
        return;
      }
      try {
        const res = await fetch('/api/park/scan-slot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticketId: currentTicket, slotId: parsedValue })
        });
        const data = await res.json();
        if (!data.success) { alert(`Scan failed: ${data.error}`); return; }
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
      setActiveTicketId(parsedValue);
      setActiveTab('EXIT');
      triggerNotification(`Ticket ${parsedValue} loaded at Exit Gate.`, 'info');
    }
  };

  const availableCount = slots.filter(s => s.status === 'AVAILABLE').length;
  const occupiedCount = slots.filter(s => s.status === 'OCCUPIED').length;
  const isAdmin = session?.role === 'ADMIN';

  // Show login screen if not logged in
  if (!session) return <LoginScreen onLogin={handleLogin} />;

  // Navigation tabs vary by role
  const tabs = [
    { id: 'GRID', label: 'Slot Map', icon: <Layers size={15} />, always: true },
    { id: 'ENTRY', label: 'Entry Kiosk', icon: <Ticket size={15} />, adminOnly: true },
    { id: 'DRIVER', label: 'My Pass', icon: <Car size={15} />, always: true },
    { id: 'SCANNER', label: 'QR Scan', icon: <Camera size={15} />, always: true },
    { id: 'EXIT', label: 'Exit & Pay', icon: <CreditCard size={15} />, always: true },
    { id: 'ADMIN', label: 'Admin', icon: <BarChart3 size={15} />, adminOnly: true },
  ].filter(t => t.always || (t.adminOnly && isAdmin));

  return (
    <div className="app-container">
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

        <nav className="nav-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon} {tab.label}
              {tab.id === 'DRIVER' && activeTicketId && (
                <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-mono)' }}>
                  {activeTicketId.slice(-4)}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="header-actions">
          {/* Live count pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(15, 23, 42, 0.6)', padding: '0.35rem 0.75rem', borderRadius: '10px', border: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--status-avail)', fontWeight: 700 }}>{availableCount} Free</span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ color: 'var(--status-occ)', fontWeight: 700 }}>{occupiedCount} Parked</span>
          </div>

          {/* User badge + logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(15, 23, 42, 0.6)', padding: '0.35rem 0.75rem', borderRadius: '10px', border: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
            {isAdmin
              ? <BarChart3 size={14} color="#34d399" />
              : <User size={14} color="#818cf8" />}
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{session.name}</span>
            <button onClick={handleLogout} title="Logout" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '0', marginLeft: '0.25rem' }}>
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Toast notification */}
      {notification && (
        <div style={{
          position: 'fixed', top: '75px', right: '20px', zIndex: 1000,
          background: notification.type === 'error' ? 'rgba(239, 68, 68, 0.92)' : notification.type === 'success' ? 'rgba(16, 185, 129, 0.92)' : 'rgba(99, 102, 241, 0.92)',
          color: '#fff', padding: '0.75rem 1.25rem', borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          fontSize: '0.88rem', fontWeight: 600, animation: 'fadeIn 0.3s ease-out'
        }}>
          {notification.type === 'error' ? <ShieldAlert size={18} /> : <Sparkles size={18} />}
          {notification.msg}
        </div>
      )}

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

        {activeTab === 'ENTRY' && isAdmin && (
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

        {activeTab === 'ADMIN' && isAdmin && (
          <AdminDashboard
            slots={slots}
            onRefreshData={fetchSlots}
          />
        )}
      </main>
    </div>
  );
}
