import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PhoneAboutModal from '../components/PhoneAboutModal';
import Footer from '../components/Footer';

const API = 'http://localhost:8000';

const BRAND_COLORS = {
  Apple: '#636366', Samsung: '#1428a0', Google: '#4285f4',
  OnePlus: '#f5010c', Nothing: '#9ca3af', Xiaomi: '#ff6c00',
  Motorola: '#006db4', Vivo: '#415fff', iQOO: '#8b5cf6',
};

const MONTH_LABELS = [
  'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'
];

function formatRelease(dateStr) {
  if (!dateStr) return 'Unknown';
  const [y, m] = dateStr.split('-');
  return `${MONTH_LABELS[parseInt(m,10)-1]} ${y}`;
}

export default function ReleasesPage() {
  const navigate = useNavigate();
  const [allPhones, setAllPhones] = useState([]);
  const [aboutPhone, setAboutPhone] = useState(null);

  const fmt = v =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumSignificantDigits: 6 }).format(v);

  useEffect(() => {
    fetch(`${API}/api/phones`)
      .then(r => r.json())
      .then(setAllPhones);
  }, []);

  // Refresh releases when phones update
  useEffect(() => {
    const handler = async () => {
      try {
        const r = await fetch(`${API}/api/phones`);
        const data = await r.json();
        setAllPhones(data);
      } catch (e) { console.error('refresh releases failed', e); }
    };
    window.addEventListener('phones-updated', handler);
    return () => window.removeEventListener('phones-updated', handler);
  }, []);

  const getCompareList = () => {
    try { return JSON.parse(localStorage.getItem('compareList') || '[]'); } catch { return []; }
  };
  const [compareList, setCompareListState] = useState(getCompareList);
  const inCompare = (id) => compareList.some(p => p.id === id);
  const toggleCompare = (phone) => {
    const current = getCompareList();
    if (current.find(p => p.id === phone.id)) {
      const next = current.filter(p => p.id !== phone.id);
      localStorage.setItem('compareList', JSON.stringify(next));
      setCompareListState(next);
    } else {
      if (current.length >= 4) { alert('Max 4 phones to compare.'); return; }
      const next = [...current, phone];
      localStorage.setItem('compareList', JSON.stringify(next));
      setCompareListState(next);
    }
  };

  // Sort phones by release_date descending
  const sorted = [...allPhones]
    .filter(p => p.release_date)
    .sort((a, b) => b.release_date.localeCompare(a.release_date));

  // Group by month
  const grouped = {};
  sorted.forEach(p => {
    const key = p.release_date;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  });

  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

  const isRecent = (dateStr) => {
    const [y, m] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, 1) >= sixMonthsAgo;
  };

  return (
    <div className="releases-page">
      {aboutPhone && (
        <PhoneAboutModal
          phone={aboutPhone}
          onClose={() => setAboutPhone(null)}
          fmt={fmt}
          onCompare={toggleCompare}
          isInCompare={inCompare(aboutPhone.id)}
        />
      )}

      <div className="rp-header">
        <button className="btn-back" onClick={() => navigate('/')}>← Home</button>
        <h1 className="cp-title">New Releases</h1>
        <p className="cp-subtitle">Latest smartphones launched in India, sorted by release date</p>
      </div>

      <div className="releases-timeline">
        {Object.keys(grouped).map(monthKey => {
          const phones = grouped[monthKey];
          const recent = isRecent(monthKey);
          return (
            <div key={monthKey} className="release-month-group">
              <div className="release-month-header">
                <span className="release-month-label">{formatRelease(monthKey)}</span>
                {recent && <span className="new-badge">NEW</span>}
              </div>
              <div className="release-cards-grid">
                {phones.map((phone, i) => (
                  <div
                    className="phone-card"
                    key={phone.id}
                    style={{ animationDelay: `${i * 0.06}s`, animation: 'fadeUp 0.4s ease-out forwards', opacity: 0, cursor: 'pointer' }}
                    onClick={() => setAboutPhone(phone)}
                  >
                    <div className="card-header">
                      <div>
                        <div className="brand" style={{ color: BRAND_COLORS[phone.brand] || '#a5b4fc' }}>{phone.brand}</div>
                        <div className="phone-name">
                          {phone.name}
                          {phone.is_new && <span className="new-badge-inline">NEW</span>}
                        </div>
                      </div>
                      {phone.water_resist && (
                        <span className="water-badge">{phone.water_resist}</span>
                      )}
                    </div>
                    <div className="price">{fmt(phone.price)}</div>
                    <div className="specs-grid">
                      <div className="spec-item"><span className="spec-label">RAM</span><span className="spec-value">{phone.ram} GB</span></div>
                      <div className="spec-item"><span className="spec-label">Camera</span><span className="spec-value">{phone.camera_mp} MP</span></div>
                      <div className="spec-item"><span className="spec-label">Battery</span><span className="spec-value">{phone.battery_mah} mAh</span></div>
                      <div className="spec-item"><span className="spec-label">Storage</span><span className="spec-value">{phone.storage_gb} GB</span></div>
                      <div className="spec-item"><span className="spec-label">Display</span><span className="spec-value">{phone.display_inch}"</span></div>
                      <div className="spec-item"><span className="spec-label">Charging</span><span className="spec-value">{phone.charging_w}W</span></div>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.5rem 0 0.75rem', lineHeight: 1.5 }}>
                      {phone.processor} · {phone.os}
                    </div>
                    <div className="card-actions" onClick={e => e.stopPropagation()}>
                      <button className="btn-about" onClick={() => setAboutPhone(phone)}>About</button>
                      <button
                        className={`btn-add-compare ${inCompare(phone.id) ? 'added' : ''}`}
                        onClick={() => toggleCompare(phone)}
                      >
                        {inCompare(phone.id) ? '✓ Added' : '+ Compare'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {compareList.length > 0 && (
        <div className="compare-float-bar" onClick={() => navigate('/compare')}>
          <span><strong>{compareList.length}</strong> phone{compareList.length > 1 ? 's' : ''} ready to compare</span>
          <button>View Comparison →</button>
        </div>
      )}

      <Footer />
    </div>
  );
}
