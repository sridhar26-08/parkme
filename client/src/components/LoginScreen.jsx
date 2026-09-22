import React, { useState } from 'react';
import { Car, ShieldCheck, User, KeyRound, Ticket, ChevronRight, AlertCircle, Sparkles, Lock } from 'lucide-react';

export default function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState(null); // null | 'driver' | 'admin'
  const [name, setName] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDriverLogin = async () => {
    if (!name.trim()) { setError('Please enter your name.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), ticketId: ticketId.trim().toUpperCase() || null })
      });
      const data = await res.json();
      if (data.success) {
        onLogin({ role: 'USER', name: name.trim(), ticketId: data.ticketId, ticket: data.ticket });
      } else {
        setError(data.error || 'Could not find that ticket. Please check the ID.');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    if (!adminUser.trim() || !adminPass.trim()) { setError('Please enter both User ID and Password.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: adminUser.trim(), password: adminPass })
      });
      const data = await res.json();
      if (data.success) {
        onLogin({ role: 'ADMIN', name: adminUser.trim() });
      } else {
        setError('Invalid User ID or Password.');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '0.75rem 1rem', borderRadius: '10px',
    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)', fontSize: '0.95rem', outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.2s'
  };
  const inputWithIconStyle = { ...inputStyle, paddingLeft: '2.5rem' };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)', padding: '1.5rem', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ position: 'absolute', top: '-120px', left: '-120px', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-80px', right: '-80px', width: '350px', height: '350px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '440px', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '72px', height: '72px', borderRadius: '22px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            boxShadow: '0 12px 35px rgba(99,102,241,0.4)', marginBottom: '1rem'
          }}>
            <Car size={34} color="#fff" />
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.03em' }}>
            PARKME MALL
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.4rem 0 0', fontSize: '0.95rem' }}>
            Smart QR Parking System
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--card-bg)', border: '1px solid var(--border-subtle)',
          borderRadius: '20px', padding: '2rem', backdropFilter: 'blur(16px)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)'
        }}>

          {/* Role selector */}
          {mode === null && (
            <div>
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', fontWeight: 500 }}>
                Select your role to continue
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                {[
                  {
                    key: 'driver',
                    icon: <User size={22} color="#818cf8" />,
                    bg: 'rgba(99,102,241,0.15)', hoverBg: 'rgba(99,102,241,0.25)',
                    border: 'rgba(99,102,241,0.35)', iconBg: 'rgba(99,102,241,0.2)',
                    title: "I'm a Driver", titleColor: '#e0e7ff',
                    sub: 'Enter your name & ticket to park'
                  },
                  {
                    key: 'admin',
                    icon: <ShieldCheck size={22} color="#34d399" />,
                    bg: 'rgba(16,185,129,0.10)', hoverBg: 'rgba(16,185,129,0.2)',
                    border: 'rgba(16,185,129,0.3)', iconBg: 'rgba(16,185,129,0.15)',
                    title: 'Admin / Staff', titleColor: '#d1fae5',
                    sub: 'Manage parking & view dashboard'
                  }
                ].map(item => (
                  <button key={item.key} onClick={() => { setMode(item.key); setError(''); }}
                    style={{
                      width: '100%', padding: '1.1rem 1.5rem',
                      background: item.bg, border: `1px solid ${item.border}`,
                      borderRadius: '14px', cursor: 'pointer', color: 'var(--text-primary)',
                      display: 'flex', alignItems: 'center', gap: '1rem', textAlign: 'left',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = item.hoverBg}
                    onMouseLeave={e => e.currentTarget.style.background = item.bg}
                  >
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: item.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {item.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: item.titleColor }}>{item.title}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{item.sub}</div>
                    </div>
                    <ChevronRight size={18} color="var(--text-muted)" style={{ marginLeft: 'auto' }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Driver Login */}
          {mode === 'driver' && (
            <div>
              <button onClick={() => { setMode(null); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.82rem', padding: '0 0 1rem' }}>← Back</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={20} color="#818cf8" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>Driver Login</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Enter your details to access your parking pass</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Your Name *</label>
                  <input type="text" placeholder="e.g. Sridhar" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleDriverLogin()} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Ticket ID <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(leave blank for a new ticket)</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Ticket size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                    <input type="text" placeholder="e.g. TKT-AB1234" value={ticketId}
                      onChange={e => setTicketId(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && handleDriverLogin()}
                      style={{ ...inputWithIconStyle, fontFamily: 'var(--font-mono)' }} />
                  </div>
                </div>
              </div>

              {error && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.9rem', padding: '0.6rem 0.85rem', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px' }}>
                <AlertCircle size={15} color="#f87171" />
                <span style={{ fontSize: '0.82rem', color: '#fca5a5' }}>{error}</span>
              </div>}

              <button onClick={handleDriverLogin} disabled={loading}
                style={{ marginTop: '1.3rem', width: '100%', padding: '0.85rem', background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.4)' }}>
                {loading ? 'Connecting...' : <><Sparkles size={16} /> Enter Parking</>}
              </button>
            </div>
          )}

          {/* Admin Login */}
          {mode === 'admin' && (
            <div>
              <button onClick={() => { setMode(null); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.82rem', padding: '0 0 1rem' }}>← Back</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Lock size={20} color="#34d399" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>Admin Login</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Restricted to authorized staff only</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>User ID</label>
                  <div style={{ position: 'relative' }}>
                    <User size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                    <input type="text" placeholder="admin" value={adminUser} onChange={e => setAdminUser(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} style={inputWithIconStyle} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <KeyRound size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                    <input type="password" placeholder="••••••••" value={adminPass} onChange={e => setAdminPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} style={inputWithIconStyle} />
                  </div>
                </div>
              </div>

              {error && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.9rem', padding: '0.6rem 0.85rem', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px' }}>
                <AlertCircle size={15} color="#f87171" />
                <span style={{ fontSize: '0.82rem', color: '#fca5a5' }}>{error}</span>
              </div>}

              <button onClick={handleAdminLogin} disabled={loading}
                style={{ marginTop: '1.3rem', width: '100%', padding: '0.85rem', background: loading ? 'rgba(16,185,129,0.4)' : 'linear-gradient(135deg, #059669, #10b981)', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', boxShadow: loading ? 'none' : '0 4px 20px rgba(16,185,129,0.35)' }}>
                {loading ? 'Verifying...' : <><ShieldCheck size={16} /> Admin Access</>}
              </button>
              <p style={{ textAlign: 'center', fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
                Default: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>admin</span> / <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>parkme123</span>
              </p>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '1.5rem' }}>
          ParkMe Smart QR Parking System · All rights reserved
        </p>
      </div>
    </div>
  );
}
