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

export default function SearchPage() {
  const navigate = useNavigate();

  const [allPhones, setAllPhones]       = useState([]);
  const [searchTerm, setSearchTerm]     = useState('');
  const [selectedBrands, setSelectedBrands] = useState(new Set());
  const [minPrice, setMinPrice]         = useState(0);
  const [maxPrice, setMaxPrice]         = useState(200000);
  const [minRam, setMinRam]             = useState(0);
  const [minCamera, setMinCamera]       = useState(0);
  const [minBattery, setMinBattery]     = useState(0);
  const [connectivity, setConnectivity] = useState('Any');
  const [showFilters, setShowFilters]   = useState(false);
  const [aboutPhone, setAboutPhone]     = useState(null);

  const fmt = v =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumSignificantDigits: 6 }).format(v);


  // Fetch all phones for filter options
  useEffect(() => {
    fetch(`${API}/api/phones`)
      .then(r => r.json())
      .then(setAllPhones);
  }, []);

  // Fetch filtered and ranked results from /api/search
  const [results, setResults] = useState([]);
  useEffect(() => {
    const body = {
      price_min: minPrice,
      price_max: maxPrice,
      ram: minRam || undefined,
      battery: minBattery || undefined,
      brand: selectedBrands.size === 1 ? [...selectedBrands][0] : undefined,
      camera: minCamera || undefined,
      q: searchTerm || undefined
    };
    fetch(`${API}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(r => r.json())
      .then(setResults);
  }, [minPrice, maxPrice, minRam, minBattery, minCamera, selectedBrands, searchTerm]);

  // Refresh catalog when backend pushes updates
  useEffect(() => {
    const handler = async () => {
      try {
        const r = await fetch(`${API}/api/phones`);
        const data = await r.json();
        setAllPhones(data);
      } catch (e) { console.error('refresh search failed', e); }
    };
    window.addEventListener('phones-updated', handler);
    return () => window.removeEventListener('phones-updated', handler);
  }, []);

  const brands    = useMemo(() => [...new Set(allPhones.map(p => p.brand))].sort(), [allPhones]);
  const ramOpts   = useMemo(() => [0, ...[...new Set(allPhones.map(p => p.ram))].sort((a,b) => a-b)], [allPhones]);
  const camOpts   = useMemo(() => [0, ...[...new Set(allPhones.map(p => p.camera_mp))].sort((a,b) => a-b)], [allPhones]);
  const batOpts   = useMemo(() => [0, ...[...new Set(allPhones.map(p => p.battery_mah))].sort((a,b) => a-b)], [allPhones]);

  const toggleBrand = (brand) =>
    setSelectedBrands(prev => {
      const next = new Set(prev);
      next.has(brand) ? next.delete(brand) : next.add(brand);
      return next;
    });

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedBrands(new Set());
    setMinPrice(0);
    setMaxPrice(200000);
    setMinRam(0);
    setMinCamera(0);
    setMinBattery(0);
    setConnectivity('Any');
  };

  // results now comes from /api/search

  const getCompareList = () => { try { return JSON.parse(localStorage.getItem('compareList') || '[]'); } catch { return []; } };
  const [compareList, setCompareListState] = useState(getCompareList);
  const inCompare = (id) => compareList.some(p => p.id === id);
  const toggleCompare = (phone) => {
    const current = getCompareList();
    const exists = current.find(p => p.id === phone.id);
    let next;
    if (exists) {
      next = current.filter(p => p.id !== phone.id);
    } else {
      if (current.length >= 4) { alert('Max 4 phones to compare.'); return; }
      next = [...current, phone];
    }
    localStorage.setItem('compareList', JSON.stringify(next));
    setCompareListState(next);
  };

  const activeFilters = selectedBrands.size + (minRam > 0 ? 1 : 0) + (minCamera > 0 ? 1 : 0) +
    (minBattery > 0 ? 1 : 0) + (minPrice > 0 || maxPrice < 200000 ? 1 : 0) + (connectivity !== 'Any' ? 1 : 0);

  return (
    <div className="search-page">
      {aboutPhone && (
        <PhoneAboutModal
          phone={aboutPhone}
          onClose={() => setAboutPhone(null)}
          fmt={fmt}
          onCompare={toggleCompare}
          isInCompare={inCompare(aboutPhone.id)}
        />
      )}

      {/* HEADER */}
      <div className="sp-header">
        <button className="btn-back" onClick={() => navigate('/')}>← Home</button>
        <h1 className="cp-title">Phone Search</h1>
        <p className="cp-subtitle">Search and filter our full catalog of {allPhones.length} phones</p>
      </div>

      {/* SEARCH BAR */}
      <div className="sp-search-wrap">
        <span className="sp-search-icon">Q</span>
        <input
          className="sp-search-input"
          placeholder="Search by name, brand, processor, OS..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          autoFocus
        />
        {searchTerm && (
          <button className="sp-clear-btn" onClick={() => setSearchTerm('')}>×</button>
        )}
      </div>

      {/* BRAND CHIPS */}
      <div className="sp-brand-section">
        <div className="sp-brand-label">Filter by Brand:</div>
        <div className="brand-chips-row">
          {brands.map(brand => (
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
      </div>

      {/* FILTER PANEL TOGGLE */}
      <div className="sp-filter-row">
        <button
          className={`filter-toggle-btn ${showFilters ? 'open' : ''}`}
          onClick={() => setShowFilters(p => !p)}
        >
          More Filters {activeFilters > 0 && <span className="filter-count">{activeFilters}</span>}
          <span style={{ marginLeft: '0.4rem' }}>{showFilters ? '▲' : '▼'}</span>
        </button>
        {activeFilters > 0 && (
          <button className="clear-filter-btn" onClick={clearFilters}>Clear All</button>
        )}
        <span className="result-count">{results.length} phone{results.length !== 1 ? 's' : ''} found</span>
      </div>

      {/* EXPANDABLE FILTERS */}
      {showFilters && (
        <div className="filter-panel">
          <div className="filter-grid">
            <div className="input-group">
              <label>Min Price <span className="val-badge">{fmt(minPrice)}</span></label>
              <input type="range" min="0" max="200000" step="5000" value={minPrice}
                onChange={e => setMinPrice(Number(e.target.value))} />
            </div>
            <div className="input-group">
              <label>Max Price <span className="val-badge">{fmt(maxPrice)}</span></label>
              <input type="range" min="10000" max="200000" step="5000" value={maxPrice}
                onChange={e => setMaxPrice(Number(e.target.value))} />
            </div>
            <div className="input-group">
              <label>Min RAM</label>
              <select className="premium-select" value={minRam} onChange={e => setMinRam(Number(e.target.value))}>
                {ramOpts.map(r => <option key={r} value={r}>{r === 0 ? 'Any' : `${r} GB`}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Min Camera</label>
              <select className="premium-select" value={minCamera} onChange={e => setMinCamera(Number(e.target.value))}>
                {camOpts.map(c => <option key={c} value={c}>{c === 0 ? 'Any' : `${c} MP`}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Min Battery</label>
              <select className="premium-select" value={minBattery} onChange={e => setMinBattery(Number(e.target.value))}>
                {batOpts.map(b => <option key={b} value={b}>{b === 0 ? 'Any' : `${b} mAh`}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Connectivity</label>
              <select className="premium-select" value={connectivity} onChange={e => setConnectivity(e.target.value)}>
                <option value="Any">Any</option>
                <option value="5G">5G</option>
                <option value="4G">4G</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* RESULTS GRID */}
      <div className="sp-results">
        {results.length === 0 ? (
          <div className="cp-empty" style={{ minHeight: 300 }}>
            <div className="cp-empty-icon">?</div>
            <h3>No phones found</h3>
            <p>Try broadening your filters or search term</p>
          </div>
        ) : (
          <div className="results-grid">
            {results.map((phone, i) => (
              <div className="phone-card" key={phone.id}
                style={{ animationDelay: `${i * 0.05}s`, animation: 'fadeUp 0.4s ease-out forwards', opacity: 0, cursor: 'pointer' }}
                onClick={() => setAboutPhone(phone)}>
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
                {typeof phone.ranking_score !== 'undefined' && (
                  <div className="ranking-score">Score: <b>{phone.ranking_score}</b></div>
                )}
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
        )}
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
