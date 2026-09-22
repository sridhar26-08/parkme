import React, { useState, useEffect } from 'react';
import { BarChart3, ShieldAlert, DollarSign, Clock, RefreshCw, AlertTriangle, Printer, RotateCcw, FastForward, CheckCircle2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function AdminDashboard({ slots, onRefreshData }) {
  const [adminData, setAdminData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showQrSheet, setShowQrSheet] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  const fetchAdminStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/overview');
      const data = await res.json();
      if (data.success) {
        setAdminData(data);
      }
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminStats();
    const interval = setInterval(fetchAdminStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleReset = async () => {
    if (!window.confirm('Reset all mall parking slots, tickets, and violations?')) return;
    try {
      const res = await fetch('/api/admin/reset', { method: 'POST' });
      const data = await res.json();
      setActionMessage(data.message);
      fetchAdminStats();
      if (onRefreshData) onRefreshData();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleTimeWarp = async () => {
    try {
      const res = await fetch('/api/admin/time-warp', { method: 'POST' });
      const data = await res.json();
      setActionMessage(data.message);
      fetchAdminStats();
      if (onRefreshData) onRefreshData();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err) {
      alert(err.message);
    }
  };

  const stats = adminData?.stats || {
    totalSlots: slots.length,
    availableSlots: slots.filter(s => s.status === 'AVAILABLE').length,
    reservedSlots: slots.filter(s => s.status === 'RESERVED').length,
    occupiedSlots: slots.filter(s => s.status === 'OCCUPIED').length,
    occupancyRate: 0,
    totalTicketsIssued: 0,
    totalRevenue: 0,
    outstandingFines: 0,
    totalViolationsCount: 0
  };

  return (
    <div>
      {/* Header and Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <BarChart3 size={24} color="#6366f1" /> Mall Parking Admin & Operations
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Real-time occupancy metrics, fine enforcement, and bay QR generation
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowQrSheet(true)}
          >
            <Printer size={15} /> Printable Bay QR Codes
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleTimeWarp}
            title="Fast-forward reservation time by 16 minutes to test 15-minute auto-expiry"
          >
            <FastForward size={15} color="var(--status-res)" /> Test Auto-Expiry (+16m)
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={handleReset}
          >
            <RotateCcw size={15} /> Reset System
          </button>
        </div>
      </div>

      {actionMessage && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid var(--status-avail-border)', color: 'var(--status-avail)', padding: '0.75rem 1rem', borderRadius: '12px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
          <CheckCircle2 size={16} /> {actionMessage}
        </div>
      )}

      {/* Metric Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
        {/* Occupancy Card */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
            <span>OCCUPANCY RATE</span>
            <span style={{ fontWeight: 700, color: '#fff' }}>{stats.occupancyRate}%</span>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginBottom: '0.4rem' }}>
            {stats.occupiedSlots + stats.reservedSlots} / {stats.totalSlots}
          </div>
          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{
              width: `${stats.occupancyRate}%`,
              height: '100%',
              background: stats.occupancyRate > 80 ? 'var(--status-occ)' : 'linear-gradient(90deg, #10b981, #6366f1)',
              borderRadius: '999px'
            }} />
          </div>
          <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.6rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>{stats.availableSlots} free</span>
            <span>•</span>
            <span>{stats.reservedSlots} reserved</span>
            <span>•</span>
            <span>{stats.occupiedSlots} parked</span>
          </div>
        </div>

        {/* Violations Card */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
            <span>RECORDED VIOLATIONS</span>
            <ShieldAlert size={16} color="#f87171" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f87171', marginBottom: '0.2rem' }}>
            {adminData?.violations?.length || 0}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Unassigned / Stolen slot infractions
          </div>
        </div>

        {/* Revenue Card */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
            <span>TOTAL REVENUE COLLECTED</span>
            <DollarSign size={16} color="var(--status-avail)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--status-avail)', marginBottom: '0.2rem' }}>
            ${stats.totalRevenue.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Includes stay fees + fine settlements
          </div>
        </div>

        {/* Outstanding Fines */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
            <span>OUTSTANDING ACTIVE FINES</span>
            <Clock size={16} color="var(--status-res)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--status-res)', marginBottom: '0.2rem' }}>
            ${stats.outstandingFines.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Pending collection at exit gates
          </div>
        </div>
      </div>

      {/* Violations Log Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title" style={{ fontSize: '1.1rem', color: '#fff' }}>
            <ShieldAlert size={20} color="#f87171" /> Real-time Slot Violation & Fine Ledger
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchAdminStats}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>

        {(!adminData?.violations || adminData.violations.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
            <CheckCircle2 size={36} style={{ color: 'var(--status-avail)', marginBottom: '0.5rem' }} />
            <p>No parking violations recorded. All drivers are parked in their assigned bays!</p>
          </div>
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Offending Ticket</th>
                  <th>Bay Taken</th>
                  <th>Originally Assigned</th>
                  <th>Fine Assessed</th>
                  <th>Status</th>
                  <th>Resolution / Reason</th>
                </tr>
              </thead>
              <tbody>
                {adminData.violations.map(v => (
                  <tr key={v.id}>
                    <td>{new Date(v.timestamp).toLocaleTimeString()}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#fff' }}>
                      {v.ticket_id}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: '#f87171', fontWeight: 700 }}>
                      {v.slot_id}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      {v.target_assigned_slot || 'N/A'}
                    </td>
                    <td style={{ color: '#f87171', fontWeight: 800 }}>
                      ${v.fine_amount.toFixed(2)}
                    </td>
                    <td>
                      <span style={{
                        fontSize: '0.72rem',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '6px',
                        background: v.fine_status === 'PAID' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: v.fine_status === 'PAID' ? 'var(--status-avail)' : '#f87171',
                        fontWeight: 700
                      }}>
                        {v.fine_status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '350px' }}>
                      {v.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Printable Physical Bay QR Codes Modal */}
      {showQrSheet && (
        <div className="modal-overlay" onClick={() => setShowQrSheet(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '880px', maxHeight: '85vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>
                  Printable Physical Bay QR Codes
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Mall operations: Print and affix these QR placards to each physical parking bay pole.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => window.print()}
                >
                  <Printer size={15} /> Print All Placards
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowQrSheet(false)}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Grid of printable QR placards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', maxHeight: '60vh', overflowY: 'auto', padding: '0.5rem' }}>
              {slots.map(s => (
                <div key={s.id} style={{ background: '#ffffff', borderRadius: '12px', padding: '1rem', textAlign: 'center', color: '#0f172a', border: '1px solid #cbd5e1' }}>
                  <div style={{ fontWeight: 800, fontSize: '1.15rem', fontFamily: 'var(--font-mono)' }}>
                    BAY {s.id}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.5rem' }}>
                    Floor {s.floor} • Grand Plaza Mall
                  </div>
                  <QRCodeSVG
                    value={JSON.stringify({ type: 'SLOT', slotId: s.id })}
                    size={120}
                    level="H"
                    includeMargin={true}
                  />
                  <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: '0.4rem', fontWeight: 600 }}>
                    Scan with Mall App to Check In
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
