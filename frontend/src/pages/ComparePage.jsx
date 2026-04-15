import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Footer from '../components/Footer';

const API = 'http://localhost:8000';

// Star Rating Display
function StarRating({ score }) {
  const full = Math.floor(score);
  const half = score - full >= 0.4;
  return (
    <span className="stars">
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ color: i <= full ? '#facc15' : (i === full+1 && half) ? '#facc15' : '#334155', opacity: i === full+1 && half ? 0.6 : 1 }}>
          ★
        </span>
      ))}
    </span>
  );
}

// Ratings Panel per phone
function RatingsCell({ phoneId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const load = useCallback(async () => {
    if (fetched || !phoneId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/ratings/${phoneId}`);
      const json = await res.json();
      setData(json);
      setFetched(true);
    } catch {
      // error handled by loading state
    }
    finally { setLoading(false); }
  }, [phoneId, fetched]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="ratings-loading"><div className="mini-spinner" />Loading...</div>;
  if (!data)   return <div className="ratings-loading" style={{color:'#f87171'}}>Error</div>;

  return (
    <div className="ratings-cell">
      <div className="ratings-avg">
        <StarRating score={data.average_rating} />
        <span className="ratings-score">{data.average_rating}</span>
        <span className="ratings-count">{data.total_reviews.toLocaleString('en-IN')} reviews</span>
      </div>
      <div className="ratings-breakdown">
        {data.breakdown.map(b => (
          <div key={b.seller} className="rb-row">
            <span className="rb-seller">{b.seller}</span>
            <div className="rb-bar-track">
              <div className="rb-bar-fill" style={{ width: `${(b.score/5)*100}%` }} />
            </div>
            <span className="rb-score">{b.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Main Compare Page
export default function ComparePage() {
  const navigate = useNavigate();

  const getList = () => {
    try { return JSON.parse(localStorage.getItem('compareList') || '[]'); }
    catch { return []; }
  };

  const [compareList, setCompareList] = useState(getList);
  const [allPhones, setAllPhones] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const fmt = v =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumSignificantDigits: 6 }).format(v);

  useEffect(() => {
    fetch(`${API}/api/phones`)
      .then(r => r.json())
      .then(data => {
        setAllPhones(data);
        const stored = getList();
        if (stored.length > 0) {
          const enriched = stored.map(sp => {
            const full = data.find(p => p.id === sp.id);
            return full ? { ...sp, ...full } : sp;
          });
          localStorage.setItem('compareList', JSON.stringify(enriched));
          setCompareList(enriched);
        }
      });
  }, []);

  // Refresh phone list and enrich compare items when backend updates phones
  useEffect(() => {
    const handler = async () => {
      try {
        const res = await fetch(`${API}/api/phones`);
        const data = await res.json();
        setAllPhones(data);
        const stored = getList();
        if (stored.length > 0) {
          const enriched = stored.map(sp => {
            const full = data.find(p => p.id === sp.id);
            return full ? { ...sp, ...full } : sp;
          });
          localStorage.setItem('compareList', JSON.stringify(enriched));
          setCompareList(enriched);
        }
      } catch (e) { console.error('refresh compare failed', e); }
    };
    window.addEventListener('phones-updated', handler);
    return () => window.removeEventListener('phones-updated', handler);
  }, []);

  const saveList = (list) => {
    localStorage.setItem('compareList', JSON.stringify(list));
    setCompareList(list);
  };

  const removePhone = (id) => saveList(compareList.filter(p => p.id !== id));
  const addPhone = (phone) => {
    if (compareList.length >= 4) { alert('Max 4 phones'); return; }
    if (compareList.find(p => p.id === phone.id)) return;
    saveList([...compareList, phone]);
  };
  const clearAll = () => saveList([]);

  const searchable = allPhones.filter(
    p => `${p.brand} ${p.name}`.toLowerCase().includes(searchTerm.toLowerCase())
      && !compareList.find(c => c.id === p.id)
  );

  const specRows = [
    { section: 'Pricing & Value',
      rows: [
        { label: 'Price',           key: 'price',         format: fmt,                  higherIsBetter: false, type: 'bar' },
      ]
    },
    { section: 'Performance',
      rows: [
        { label: 'RAM',             key: 'ram',           format: v=>`${v} GB`,         higherIsBetter: true,  type: 'bar' },
        { label: 'Storage',         key: 'storage_gb',    format: v=>`${v} GB`,         higherIsBetter: true,  type: 'bar' },
        { label: 'Processor',       key: 'processor',     format: v=>v,                 higherIsBetter: null,  type: 'text' },
        { label: 'OS',              key: 'os',            format: v=>v,                 higherIsBetter: null,  type: 'text' },
      ]
    },
    { section: 'Display',
      rows: [
        { label: 'Screen Size',     key: 'display_inch',  format: v=>`${v}"`,           higherIsBetter: true,  type: 'bar' },
        { label: 'Refresh Rate',    key: 'refresh_hz',    format: v=>`${v} Hz`,         higherIsBetter: true,  type: 'bar' },
      ]
    },
    { section: 'Camera',
      rows: [
        { label: 'Camera',          key: 'camera_mp',     format: v=>`${v} MP`,         higherIsBetter: true,  type: 'bar' },
      ]
    },
    { section: 'Battery & Charging',
      rows: [
        { label: 'Battery',         key: 'battery_mah',   format: v=>`${v} mAh`,        higherIsBetter: true,  type: 'bar' },
        { label: 'Charging',        key: 'charging_w',    format: v=>`${v}W`,           higherIsBetter: true,  type: 'bar' },
      ]
    },
    { section: 'Build',
      rows: [
        { label: 'Weight',          key: 'weight_g',      format: v=>`${v} g`,          higherIsBetter: false, type: 'bar' },
        { label: 'Water Resist.',   key: 'water_resist',  format: v=>v,                 higherIsBetter: null,  type: 'badge' },
        { label: 'Connectivity',    key: 'connectivity',   format: v=>v,                 higherIsBetter: null,  type: 'badge' },
      ]
    },
  ];

  const allFlatRows = specRows.flatMap(s => s.rows);

  const getBest = (key, higherIsBetter) => {
    const vals = compareList.map(p => p[key]).filter(v => typeof v === 'number');
    if (!vals.length) return null;
    return higherIsBetter ? Math.max(...vals) : Math.min(...vals);
  };

  const getBarPct = (val, key, higherIsBetter) => {
    const vals = compareList.map(p => p[key]).filter(v => typeof v === 'number');
    const max = Math.max(...vals), min = Math.min(...vals);
    if (max === min) return 100;
    const raw = (val - min) / (max - min) * 100;
    return higherIsBetter ? raw : 100 - raw;
  };

  const countWins = () => {
    const wins = {};
    compareList.forEach(p => wins[p.id] = 0);
    allFlatRows.filter(r => r.higherIsBetter !== null && r.type === 'bar').forEach(({ key, higherIsBetter }) => {
      const best = getBest(key, higherIsBetter);
      compareList.forEach(p => { if (p[key] === best) wins[p.id]++; });
    });
    return wins;
  };

  const wins = compareList.length > 0 ? countWins() : {};
  const maxWins = Math.max(...Object.values(wins), 0);
  const overallWinner = compareList.find(p => wins[p.id] === maxWins);

  const brandColors = {
    Apple: '#636366', Samsung: '#1428a0', Google: '#4285f4',
    OnePlus: '#f5010c', Nothing: '#9ca3af', Xiaomi: '#ff6c00',
    Motorola: '#006db4', Vivo: '#415fff', iQOO: '#8b5cf6',
  };

  const waterColor = (ip) => {
    if (!ip) return '#475569';
    if (ip.includes('68') || ip.includes('69') || ip.includes('X8')) return '#34d399';
    if (ip.includes('67')) return '#60a5fa';
    if (ip.includes('65') || ip.includes('64')) return '#f59e0b';
    return '#94a3b8';
  };

  return (
    <div className="compare-page">
      {/* PAGE HEADER */}
      <div className="cp-header">
        <div>
          <button className="btn-back" onClick={() => navigate('/')}>← Home</button>
          <h1 className="cp-title">Phone Comparison</h1>
          <p className="cp-subtitle">Side-by-side deep comparison of up to 4 phones</p>
        </div>
        {compareList.length > 0 && (
          <button className="btn-clear" onClick={clearAll}>Clear All</button>
        )}
      </div>

      <div className="cp-body">
        {/* SIDEBAR */}
        <div className="cp-sidebar">
          <h3 className="sidebar-title">Add Phones ({compareList.length}/4)</h3>
          <input className="search-input" placeholder="Search all phones..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <div className="phone-pick-list">
            {searchable.map(phone => (
              <div key={phone.id} className="phone-pick-item" onClick={() => addPhone(phone)}>
                <div>
                  <span className="brand-dot" style={{ background: brandColors[phone.brand] || '#6366f1' }} />
                  <span className="pick-name">{phone.brand} {phone.name}</span>
                </div>
                <span className="pick-price">{fmt(phone.price)}</span>
              </div>
            ))}
            {searchable.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
                No phones found
              </p>
            )}
          </div>
        </div>

        {/* MAIN COMPARISON */}
        <div className="cp-main">
          {compareList.length === 0 ? (
            <div className="cp-empty">
              <div className="cp-empty-icon">⇔</div>
              <h3>No phones added yet</h3>
              <p>Search and pick phones from the left panel to start the comparison</p>
            </div>
          ) : (
            <>
              {/* WINNER BANNER */}
              {overallWinner && compareList.length > 1 && (
                <div className="winner-banner" style={{ marginBottom: '1.5rem' }}>
                  <strong>{overallWinner.brand} {overallWinner.name}</strong> wins overall
                  with <strong>{wins[overallWinner.id]}</strong> spec wins!
                </div>
              )}

              {/* STICKY PHONE HEADERS */}
              <div className="compare-cols">
                <div className="compare-spec-header">Spec</div>
                {compareList.map(phone => (
                  <div key={phone.id} className="compare-phone-header"
                    style={{ borderTopColor: brandColors[phone.brand] || '#6366f1' }}>
                    <button className="remove-btn" onClick={() => removePhone(phone.id)}>×</button>
                    <div className="cph-brand" style={{ color: brandColors[phone.brand] || '#6366f1' }}>{phone.brand}</div>
                    <div className="cph-name">{phone.name}</div>
                    <div className="cph-wins">{wins[phone.id]} spec win{wins[phone.id] !== 1 ? 's' : ''}</div>
                  </div>
                ))}
              </div>

              {/* SPEC SECTIONS */}
              {specRows.map(section => (
                <div key={section.section}>
                  <div className="compare-section-header">
                    <div className="compare-spec-header section-label">{section.section}</div>
                    {compareList.map(p => <div key={p.id} className="compare-section-filler" />)}
                  </div>

                  {section.rows.map(({ label, key, format, higherIsBetter, type }) => {
                    const best = higherIsBetter !== null ? getBest(key, higherIsBetter) : null;
                    return (
                      <div key={key} className="compare-row">
                        <div className="compare-spec-cell">{label}</div>
                        {compareList.map(phone => {
                          const val = phone[key];
                          const isBest = higherIsBetter !== null && val === best;
                          const barPct = type === 'bar' ? getBarPct(val, key, higherIsBetter) : 0;

                          return (
                            <div key={phone.id} className={`compare-value-cell ${isBest ? 'is-best' : ''}`}>
                              {type === 'bar' && (
                                <>
                                  <div className="cv-value">{format(val)}</div>
                                  <div className="cv-bar-track">
                                    <div className="cv-bar-fill" style={{
                                      width: `${Math.max(barPct, 4)}%`,
                                      background: isBest
                                        ? 'linear-gradient(90deg,#34d399,#059669)'
                                        : 'rgba(255,255,255,0.1)',
                                    }} />
                                  </div>
                                  {isBest && <span className="cv-best-label">Best</span>}
                                </>
                              )}
                              {type === 'text' && (
                                <div className="cv-text">{format(val) || '—'}</div>
                              )}
                              {type === 'badge' && (
                                <span className="cv-badge"
                                  style={{ background: key === 'water_resist' ? `${waterColor(val)}22` : 'rgba(99,102,241,0.15)',
                                           color: key === 'water_resist' ? waterColor(val) : '#a5b4fc',
                                           border: `1px solid ${key === 'water_resist' ? waterColor(val) + '55' : 'rgba(99,102,241,0.3)'}` }}>
                                  {format(val) || '—'}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* RATINGS SECTION */}
              <div>
                <div className="compare-section-header">
                  <div className="compare-spec-header section-label">User Ratings</div>
                  {compareList.map(p => <div key={p.id} className="compare-section-filler" />)}
                </div>
                <div className="compare-row ratings-row">
                  <div className="compare-spec-cell">Avg Rating</div>
                  {compareList.map(phone => (
                    <div key={phone.id} className="compare-value-cell">
                      <RatingsCell phoneId={phone.id} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
