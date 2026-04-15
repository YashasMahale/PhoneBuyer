import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PhoneAboutModal from '../components/PhoneAboutModal';
import Footer from '../components/Footer';

const API = 'http://localhost:8000';

const BRAND_COLORS = {
  Apple: '#636366', Samsung: '#1428a0', Google: '#4285f4',
  OnePlus: '#f5010c', Nothing: '#9ca3af', Xiaomi: '#ff6c00',
  Motorola: '#006db4', Vivo: '#415fff', iQOO: '#8b5cf6',
};

const CATEGORIES = [
  { key: 'popularity', label: 'Popularity', desc: 'Ranked by buyer interest and review volume' },
  { key: 'features',   label: 'Features',   desc: 'Composite: RAM, storage, display and more' },
  { key: 'camera',     label: 'Camera',     desc: 'Highest resolution and photo quality' },
  { key: 'battery',    label: 'Battery',    desc: 'Battery capacity + fast charging speed' },
  { key: 'power',      label: 'Power',      desc: 'Processor tier + RAM performance' },
  { key: 'value',      label: 'Value',      desc: 'Best specs per rupee spent' },
];

const MEDAL_LABEL = { 1: '#1', 2: '#2', 3: '#3' };
const MEDAL_COLOR = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };

export default function RankingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [period, setPeriod]     = useState(searchParams.get('period')   || 'week');
  const [category, setCategory] = useState(searchParams.get('category') || 'popularity');
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [aboutPhone, setAboutPhone] = useState(null);

  const getCompareList = () => { try { return JSON.parse(localStorage.getItem('compareList') || '[]'); } catch { return []; } };
  const [compareList, setCompareListState] = useState(getCompareList);
  const inCompare = (id) => compareList.some(p => p.id === id);
  const toggleCompare = (phone) => {
    const current = getCompareList();
    let next;
    if (current.find(p => p.id === phone.id)) {
      next = current.filter(p => p.id !== phone.id);
    } else {
      if (current.length >= 4) { alert('Max 4 phones to compare.'); return; }
      next = [...current, phone];
    }
    localStorage.setItem('compareList', JSON.stringify(next));
    setCompareListState(next);
  };

  const fmt = v =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumSignificantDigits: 6 }).format(v);

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      try {
        const r = await fetch(`${API}/api/rankings?period=${period}&category=${category}`);
        const data = await r.json();
        if (!ignore) setRankings(data);
      } catch {
        // error handled by loading state
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => { ignore = true; };
  }, [period, category]);

  // Re-fetch rankings when backend notifies of phone updates
  useEffect(() => {
    const handler = () => {
      (async () => {
        setLoading(true);
        try {
          const r = await fetch(`${API}/api/rankings?period=${period}&category=${category}`);
          const data = await r.json();
          setRankings(data);
        } catch (e) { console.error('refresh rankings failed', e); }
        finally { setLoading(false); }
      })();
    };
    window.addEventListener('phones-updated', handler);
    return () => window.removeEventListener('phones-updated', handler);
  }, [period, category]);

  const activeCat = CATEGORIES.find(c => c.key === category);
  const maxScore  = rankings.length > 0 ? rankings[0].score : 100;

  return (
    <div className="ranking-page">
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
      <div className="rp-header">
        <button className="btn-back" onClick={() => navigate('/')}>← Home</button>
        <div className="rp-title-row">
          <div>
            <h1 className="cp-title">Phone Rankings</h1>
            <p className="cp-subtitle">
              {activeCat?.desc}
            </p>
          </div>
          <div className="period-pills">
            {['week', 'month'].map(p => (
              <button
                key={p}
                className={`period-pill ${period === p ? 'active' : ''}`}
                onClick={() => setPeriod(p)}
              >
                {p === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CATEGORY TABS */}
      <div className="cat-tabs-wrap">
        <div className="cat-tabs">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              className={`cat-tab ${category === cat.key ? 'active' : ''}`}
              onClick={() => setCategory(cat.key)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* RANKED LIST */}
      <div className="rp-body">
        {loading ? (
          <div className="loading-wrapper">
            <div className="spinner" />
            <div className="loading-text">Computing Rankings...</div>
          </div>
        ) : (
          <div className="rank-list">
            {/* Top 3 podium */}
            {rankings.length >= 3 && (
              <div className="podium-row">
                {[rankings[1], rankings[0], rankings[2]].map((phone) => {
                  const realRank = phone.rank;
                  return (
                    <div
                      key={phone.id}
                      className={`podium-card podium-${realRank}`}
                      style={{ '--medal-color': MEDAL_COLOR[realRank], cursor: 'pointer' }}
                      onClick={() => setAboutPhone(phone)}
                    >
                      <div className="podium-medal">{MEDAL_LABEL[realRank]}</div>
                      <div className="podium-brand" style={{ color: BRAND_COLORS[phone.brand] || '#6366f1' }}>
                        {phone.brand}
                      </div>
                      <div className="podium-name">
                        {phone.name}
                        {phone.is_new && <span className="new-badge-inline">NEW</span>}
                      </div>
                      <div className="podium-score">{phone.score}</div>
                      <div className="podium-price">{fmt(phone.price)}</div>
                      <div className="podium-specs">
                        {phone.ram}GB · {phone.camera_mp}MP · {phone.battery_mah}mAh
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Rest of rankings */}
            <div className="rank-rest">
              {rankings.slice(3).map(phone => (
                <div key={phone.id} className="rank-item" style={{ cursor: 'pointer' }} onClick={() => setAboutPhone(phone)}>
                  <div className="rank-num">{phone.rank}</div>
                  <div className="rank-info">
                    <div className="rank-brand" style={{ color: BRAND_COLORS[phone.brand] || '#6366f1' }}>
                      {phone.brand}
                    </div>
                    <div className="rank-name">
                      {phone.name}
                      {phone.is_new && <span className="new-badge-inline">NEW</span>}
                    </div>
                    <div className="rank-specs">
                      {phone.ram}GB RAM · {phone.camera_mp}MP · {fmt(phone.price)}
                    </div>
                  </div>
                  <div className="rank-bar-section">
                    <div className="rank-bar-track">
                      <div
                        className="rank-bar-fill"
                        style={{ width: `${(phone.score / maxScore) * 100}%` }}
                      />
                    </div>
                    <span className="rank-score">{phone.score}</span>
                  </div>
                </div>
              ))}
            </div>
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
