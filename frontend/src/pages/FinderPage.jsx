import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PhoneAboutModal from '../components/PhoneAboutModal';
import Footer from '../components/Footer';

const API = 'http://localhost:8000';

const BRAND_COLORS = {
  Apple: '#636366', Samsung: '#1428a0', Google: '#4285f4',
  OnePlus: '#f5010c', Nothing: '#9ca3af', Xiaomi: '#ff6c00',
  Motorola: '#006db4', Vivo: '#415fff', iQOO: '#8b5cf6',
};

export default function FinderPage() {
  const navigate = useNavigate();

  const [requirements, setRequirements] = useState({
    max_budget: 80000, min_ram: 8, min_camera_mp: 48, min_battery_mah: 4000, has_exchange: false,
  });

  const [loading, setLoading]           = useState(false);
  const [results, setResults]           = useState([]);
  const [hasSearched, setHasSearched]   = useState(false);
  const [loadingRetailers, setLoadingRetailers] = useState({});
  const [retailersData, setRetailersData]       = useState({});
  const [availableOptions, setAvailableOptions] = useState({ ram: [], camera: [], battery: [] });
  const [allPhones, setAllPhones]       = useState([]);
  const [selectedBrands, setSelectedBrands]     = useState(new Set());
  const [aboutPhone, setAboutPhone]     = useState(null);

  const allBrands = useMemo(() => [...new Set(allPhones.map(p => p.brand))].sort(), [allPhones]);

  const toggleBrand = (brand) =>
    setSelectedBrands(prev => {
      const next = new Set(prev);
      next.has(brand) ? next.delete(brand) : next.add(brand);
      return next;
    });

  const filteredResults = useMemo(
    () => selectedBrands.size === 0 ? results : results.filter(p => selectedBrands.has(p.brand)),
    [results, selectedBrands]
  );

  const getCompareList = () => {
    try { return JSON.parse(localStorage.getItem('compareList') || '[]'); } catch { return []; }
  };
  const [compareList, setCompareListState] = useState(getCompareList);

  const saveCompareList = (list) => {
    localStorage.setItem('compareList', JSON.stringify(list));
    setCompareListState(list);
  };

  const toggleCompare = (phone) => {
    const current = getCompareList();
    const exists = current.find(p => p.id === phone.id);
    if (exists) {
      saveCompareList(current.filter(p => p.id !== phone.id));
    } else {
      if (current.length >= 4) { alert('Max 4 phones to compare.'); return; }
      const full = allPhones.find(p => p.id === phone.id);
      saveCompareList([...current, full ? { ...phone, ...full } : phone]);
    }
  };

  const isInCompare = (id) => compareList.some(p => p.id === id);

  useEffect(() => {
    fetch(`${API}/api/phones`)
      .then(r => r.json())
      .then(data => {
        setAllPhones(data);
        setAvailableOptions({
          ram:     [...new Set(data.map(p => p.ram))].sort((a,b) => a-b),
          camera:  [...new Set(data.map(p => p.camera_mp))].sort((a,b) => a-b),
          battery: [...new Set(data.map(p => p.battery_mah))].sort((a,b) => a-b),
        });
      });
  }, []);

  // Refresh phone dataset when backend notifies updates
  useEffect(() => {
    const handler = async () => {
      try {
        const r = await fetch(`${API}/api/phones`);
        const data = await r.json();
        setAllPhones(data);
        setAvailableOptions({
          ram:     [...new Set(data.map(p => p.ram))].sort((a,b) => a-b),
          camera:  [...new Set(data.map(p => p.camera_mp))].sort((a,b) => a-b),
          battery: [...new Set(data.map(p => p.battery_mah))].sort((a,b) => a-b),
        });
      } catch (e) { console.error('refresh finder failed', e); }
    };
    window.addEventListener('phones-updated', handler);
    return () => window.removeEventListener('phones-updated', handler);
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setRequirements(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : Number(value) }));
  };

  const handleSearch = async () => {
    setLoading(true); setHasSearched(true); setRetailersData({});
    try {
      const res = await fetch(`${API}/api/recommend`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requirements),
      });
      const data = await res.json();
      setTimeout(() => { setResults(data); setLoading(false); }, 1200);
    } catch { setLoading(false); }
  };

  const checkRetailers = async (phoneId) => {
    setLoadingRetailers(prev => ({ ...prev, [phoneId]: true }));
    try {
      const res = await fetch(`${API}/api/retailers/${phoneId}?has_exchange=${requirements.has_exchange}`);
      const data = await res.json();
      setRetailersData(prev => ({ ...prev, [phoneId]: data }));
    } catch {
      // error handled by loading state
    }
    finally { setLoadingRetailers(prev => ({ ...prev, [phoneId]: false })); }
  };

  const fmt = v =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumSignificantDigits: 6 }).format(v);

  return (
    <div className="app-container">
      {aboutPhone && (
        <PhoneAboutModal
          phone={aboutPhone}
          onClose={() => setAboutPhone(null)}
          fmt={fmt}
          onCompare={toggleCompare}
          isInCompare={isInCompare(aboutPhone.id)}
        />
      )}

      <header className="header">
        <div className="header-top">
          <div>
            <button className="btn-back" onClick={() => navigate('/')}>← Home</button>
            <h1 className="title">AI Finder</h1>
            <p className="subtitle">Tell us what you need. ML ranks the best phones for you.</p>
          </div>
          <button className="btn-compare" onClick={() => navigate('/compare')}>
            Compare {compareList.length > 0 && <span className="compare-badge">{compareList.length}</span>}
          </button>
        </div>
      </header>

      <main>
        <div className="glass-panel">
          <div className="form-grid">
            <div className="input-group">
              <label>Max Budget <span className="val-badge">{fmt(requirements.max_budget)}</span></label>
              <input type="range" name="max_budget" min="10000" max="200000" step="5000"
                value={requirements.max_budget} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label>Min RAM</label>
              <select name="min_ram" value={requirements.min_ram} onChange={handleChange} className="premium-select">
                {availableOptions.ram.map(r => <option key={r} value={r}>{r} GB</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Camera Quality</label>
              <select name="min_camera_mp" value={requirements.min_camera_mp} onChange={handleChange} className="premium-select">
                {availableOptions.camera.map(c => <option key={c} value={c}>{c} MP</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Battery Capacity</label>
              <select name="min_battery_mah" value={requirements.min_battery_mah} onChange={handleChange} className="premium-select">
                {availableOptions.battery.map(b => <option key={b} value={b}>{b} mAh</option>)}
              </select>
            </div>
            <div className="input-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '1rem' }}>
              <label style={{ width: 'auto', marginBottom: 0 }}>Include Exchange Offer?</label>
              <input type="checkbox" name="has_exchange" checked={requirements.has_exchange}
                onChange={handleChange} style={{ width: 20, height: 20, cursor: 'pointer', appearance: 'auto' }} />
            </div>
          </div>

          <button className="btn-primary" onClick={handleSearch} disabled={loading}>
            {loading ? 'Processing ML Matrix...' : 'Find My Perfect Phone'}
          </button>

          {/* BRAND FILTER CHIPS */}
          {allBrands.length > 0 && (
            <div className="brand-filter-section">
              <div className="brand-filter-label">
                Filter by Brand
                {selectedBrands.size > 0 && (
                  <button className="clear-filter-btn" onClick={() => setSelectedBrands(new Set())}>
                    Clear
                  </button>
                )}
              </div>
              <div className="brand-chips-row">
                {allBrands.map(brand => (
                  <button
                    key={brand}
                    className={`brand-chip ${selectedBrands.has(brand) ? 'active' : ''}`}
                    style={{ '--chip-color': BRAND_COLORS[brand] || '#6366f1' }}
                    onClick={() => toggleBrand(brand)}
                  >
                    <span className="chip-dot" style={{ background: BRAND_COLORS[brand] || '#6366f1' }} />
                    {brand}
                  </button>
                ))}
              </div>
              {selectedBrands.size > 0 && (
                <div className="brand-filter-note">
                  Filtering to: {[...selectedBrands].join(', ')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RESULTS */}
        {hasSearched && (
          <div style={{ marginTop: '3rem' }}>
            {loading ? (
              <div className="loading-wrapper">
                <div className="spinner" />
                <div className="loading-text">Running Cosine Similarity Engine...</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                  <h2 className="results-header" style={{ margin: 0 }}>Your Top Matches</h2>
                  {selectedBrands.size > 0 && results.length > 0 && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {filteredResults.length} of {results.length} shown ·{' '}
                      <button style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 'inherit' }}
                        onClick={() => setSelectedBrands(new Set())}>Show all</button>
                    </span>
                  )}
                </div>
                {filteredResults.length > 0 ? (
                  <div className="results-grid">
                    {filteredResults.map((phone, i) => (
                      <div className="phone-card" key={phone.id}
                        style={{ animationDelay: `${i * 0.1}s`, animation: 'fadeUp 0.5s ease-out forwards', opacity: 0, cursor: 'pointer' }}
                        onClick={() => setAboutPhone(phone)}>
                        <div className="card-header">
                          <div>
                            <div className="brand" style={{ color: BRAND_COLORS[phone.brand] || '#a5b4fc' }}>{phone.brand}</div>
                            <div className="phone-name">{phone.name}</div>
                          </div>
                          <div className="match-badge">{phone.match_score}% Match</div>
                        </div>
                        <div className="price">{fmt(phone.price)}</div>
                        <div className="specs-grid">
                          <div className="spec-item"><span className="spec-label">Memory</span><span className="spec-value">{phone.ram} GB</span></div>
                          <div className="spec-item"><span className="spec-label">Camera</span><span className="spec-value">{phone.camera_mp} MP</span></div>
                          <div className="spec-item"><span className="spec-label">Battery</span><span className="spec-value">{phone.battery_mah} mAh</span></div>
                        </div>
                        <div className="card-actions" onClick={e => e.stopPropagation()}>
                          <button className="btn-about" onClick={() => setAboutPhone(phone)}>About</button>
                          <button className={`btn-add-compare ${isInCompare(phone.id) ? 'added' : ''}`}
                            onClick={() => toggleCompare(phone)}>
                            {isInCompare(phone.id) ? '✓ Added' : '+ Compare'}
                          </button>
                        </div>
                        {!retailersData[phone.id] && !loadingRetailers[phone.id] && (
                          <button className="btn-retailer" onClick={() => checkRetailers(phone.id)}>
                            Check Online Stores
                          </button>
                        )}
                        {loadingRetailers[phone.id] && (
                          <div className="retailer-container">
                            <div className="scanning-pulse">
                              <div className="pulse-dot" />
                              <span>Scanning Indian Retailers...</span>
                            </div>
                          </div>
                        )}
                        {retailersData[phone.id] && (
                          <div className="retailer-container">
                            <div className="retailer-list">
                              {retailersData[phone.id].map((store, idx) => (
                                <div className={`retailer-item ${store.is_special ? 'special-deal' : ''}`} key={idx}>
                                  <div className="retailer-info">
                                    <span className="retailer-name">{store.name}</span>
                                    <span className="retailer-stock">{store.stock}</span>
                                  </div>
                                  <div className="retailer-actions">
                                    <span className="retailer-price" style={store.is_special ? { color: 'gold' } : {}}>{fmt(store.price)}</span>
                                    {store.url !== '#' ? (
                                      <a href={store.url} target="_blank" rel="noopener noreferrer" className="btn-buy">Buy</a>
                                    ) : (
                                      <button className="btn-buy"
                                        onClick={() => alert(store.offer_details)}
                                        style={{ background: 'gold', color: 'black', cursor: 'pointer', border: 'none' }}>
                                        View Offer
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>
                    {results.length === 0
                      ? 'No phones found. Try increasing your max budget.'
                      : 'No results for selected brands. Clear the brand filter to see all matches.'}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
