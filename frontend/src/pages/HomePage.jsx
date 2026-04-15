// ScrollRow moved outside HomePage to fix ESLint error
function ScrollRow({ phones, setAboutPhone }) {
  const BRAND_COLORS = {
    Apple: '#636366', Samsung: '#1428a0', Google: '#4285f4',
    OnePlus: '#f5010c', Nothing: '#9ca3af', Xiaomi: '#ff6c00',
    Motorola: '#006db4', Vivo: '#415fff', iQOO: '#8b5cf6',
  };
  return (
    <div className="ph-scroll">
      {phones.map((phone, i) => (
        <div className="ph-scroll-card" key={phone.id}
          style={{ borderTopColor: BRAND_COLORS[phone.brand] || '#6366f1', cursor: 'pointer' }}
          onClick={() => setAboutPhone(phone)}>
          <div className="phs-rank">#{i + 1}</div>
          <div className="phs-brand" style={{ color: BRAND_COLORS[phone.brand] || '#6366f1' }}>{phone.brand}</div>
          <div className="phs-name">
            {phone.name}
            {phone.is_new && <span className="new-badge-inline">NEW</span>}
          </div>
          <div className="phs-specs">{phone.ram}GB · {phone.camera_mp}MP · {phone.battery_mah}mAh</div>
          <div className="phs-price">{phone.price && new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumSignificantDigits: 6 }).format(phone.price)}</div>
        </div>
      ))}
    </div>
  );
}
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

const PROCESSOR_TIERS = {
  'Apple A19 Pro': 100, 'Apple A19': 97, 'Apple A18': 92, 'Apple A16 Bionic': 85,
  'Snapdragon 8 Elite Gen 5': 100, 'Snapdragon 8 Elite': 97, 'Snapdragon 8 Gen 3': 90,
  'Snapdragon 8 Gen 2': 85, 'Snapdragon 8+ Gen 1': 80, 'Snapdragon 7 Gen 3': 68,
  'Dimensity 9400': 95, 'Dimensity 9300': 90, 'Dimensity 7200 Pro': 62,
  'Google Tensor G5': 88, 'Google Tensor G4': 82, 'Google Tensor G3': 78,
  'Exynos 1580': 66, 'Exynos 1380': 63,
};

const FEATURE_CARDS = [
  {
    icon: 'AI', title: 'AI Finder', subtitle: 'Perfect match, instantly',
    desc: 'Our cosine-similarity ML engine scores every phone against your requirements — budget, RAM, camera, and battery.',
    color: '#6366f1', path: '/finder', label: 'Find My Phone →',
  },
  {
    icon: '★', title: 'Rankings', subtitle: "What's hot right now",
    desc: 'Weekly and monthly charts across 6 categories: popularity, features, camera, battery, power, and value.',
    color: '#f59e0b', path: '/ranking', label: 'View Rankings →',
  },
  {
    icon: '⇔', title: 'Comparer', subtitle: 'Deep side-by-side analysis',
    desc: 'Compare up to 4 phones across 12+ spec rows. Animated bars reveal the winner in every category.',
    color: '#10b981', path: '/compare', label: 'Compare Phones →',
  },
  {
    icon: 'Q', title: 'Search', subtitle: 'Your catalog, your filters',
    desc: 'Live search the full catalog. Filter by multiple brands, price range, RAM, camera, battery and 5G.',
    color: '#3b82f6', path: '/search', label: 'Search Catalog →',
  },
  {
    icon: '✦', title: 'New Releases', subtitle: 'Just launched in India',
    desc: 'Browse the latest smartphones released in India, sorted by launch date with full spec sheets.',
    color: '#ec4899', path: '/releases', label: 'See Releases →',
  },
];

const NAV_ITEMS = [
  { icon: 'AI', title: 'Finder', path: '/finder' },
  { icon: '★', title: 'Rankings', path: '/ranking' },
  { icon: '⇔', title: 'Compare', path: '/compare' },
  { icon: 'Q', title: 'Search', path: '/search' },
  { icon: '✦', title: 'Releases', path: '/releases' },
];

const seeded = n => { const s = Math.sin(n) * 10000; return s - Math.floor(s); };
const norm = (val, arr) => {
  const mn = Math.min(...arr), mx = Math.max(...arr);
  return mx === mn ? 0.5 : (val - mn) / (mx - mn);
};

export default function HomePage() {
  const navigate = useNavigate();
  const [phones, setPhones] = useState([]);
  const [loading, setLoading] = useState(true);
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
    fetch(`${API}/api/phones`)
      .then(r => r.json())
      .then(data => { setPhones(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Update phone list when backend notifies of changes
  useEffect(() => {
    const handler = async () => {
      try {
        const r = await fetch(`${API}/api/phones`);
        const data = await r.json();
        setPhones(data);
      } catch (e) { console.error('refresh home failed', e); }
    };
    window.addEventListener('phones-updated', handler);
    return () => window.removeEventListener('phones-updated', handler);
  }, []);

  const trendingWeek = phones.length > 0
    ? [...phones]
        .map(p => ({ ...p, _score: seeded(p.id * 17 + 3) * 40 + 60 + (1 - norm(p.price, phones.map(x => x.price))) * 20 + (p.is_new ? 5 : 0) }))
        .sort((a, b) => b._score - a._score).slice(0, 6)
    : [];

  const topMonth = phones.length > 0
    ? [...phones].map(p => ({
        ...p,
        _score: 0.25 * norm(p.camera_mp, phones.map(x => x.camera_mp))
               + 0.20 * norm(p.ram, phones.map(x => x.ram))
               + 0.20 * norm(p.battery_mah, phones.map(x => x.battery_mah))
               + 0.20 * norm(p.storage_gb, phones.map(x => x.storage_gb))
               + 0.15 * norm(p.charging_w, phones.map(x => x.charging_w)),
      })).sort((a, b) => b._score - a._score).slice(0, 6)
    : [];

  const bestCamera  = phones.length > 0 ? [...phones].sort((a,b) => b.camera_mp - a.camera_mp)[0] : null;
  const bestBattery = phones.length > 0 ? [...phones].sort((a,b) => b.battery_mah - a.battery_mah)[0] : null;
  const bestValue   = phones.length > 0
    ? [...phones].map(p => ({ ...p, _v: (p.camera_mp/10 + p.ram + p.battery_mah/1000) / (p.price/100000) }))
        .sort((a,b) => b._v - a._v)[0]
    : null;
  const bestPower = phones.length > 0
    ? [...phones].map(p => ({ ...p, _p: (PROCESSOR_TIERS[p.processor]||60)*0.6 + p.ram * (100/16) * 0.4 }))
        .sort((a,b) => b._p - a._p)[0]
    : null;

  const bests = [
    { label: 'Best Camera',    phone: bestCamera,  val: bestCamera  ? `${bestCamera.camera_mp} MP`     : '' },
    { label: 'Best Battery',   phone: bestBattery, val: bestBattery ? `${bestBattery.battery_mah} mAh` : '' },
    { label: 'Best Value',     phone: bestValue,   val: bestValue   ? fmt(bestValue.price)              : '' },
    { label: 'Most Powerful',  phone: bestPower,   val: bestPower   ? bestPower.processor               : '' },
  ];

  const compareCount = compareList.length;

  return (
    <div className="home-page">
      {aboutPhone && (
        <PhoneAboutModal
          phone={aboutPhone}
          onClose={() => setAboutPhone(null)}
          fmt={fmt}
          onCompare={toggleCompare}
          isInCompare={inCompare(aboutPhone.id)}
        />
      )}
      {/* HERO */}
      <section className="home-hero">
        <div className="hero-glow" />
        <div className="hero-glow hero-glow-2" />
        <div className="hero-content">
          <div className="hero-eyebrow">AI · ML · Real-time Prices · India</div>
          <h1 className="hero-title">
            Find Your <span className="gradient-word">Perfect</span><br />Smartphone
          </h1>
          <p className="hero-sub">
            ML-powered recommendations, real-time Indian retailer prices, deep spec comparison —
            everything you need to make the right choice.
          </p>
          <div className="hero-cta-group">
            <button className="hero-cta-primary" onClick={() => navigate('/finder')}>Find My Phone</button>
            <button className="hero-cta-secondary" onClick={() => navigate('/ranking')}>View Rankings</button>
          </div>
          <div className="hero-stats">
            <div className="hero-stat"><strong>{phones.length || '—'}</strong><span>Phones</span></div>
            <div className="stat-div" />
            <div className="hero-stat"><strong>5</strong><span>Retailers</span></div>
            <div className="stat-div" />
            <div className="hero-stat"><strong>12+</strong><span>Spec Points</span></div>
            <div className="stat-div" />
            <div className="hero-stat"><strong>AI</strong><span>Powered</span></div>
          </div>
        </div>
      </section>

      {/* FEATURE CARDS */}
      <section className="feature-section">
        <div className="home-inner">
          <div className="feature-grid feature-grid-5">
            {FEATURE_CARDS.map(card => (
              <div key={card.path} className="feature-card"
                style={{ '--card-color': card.color }}
                onClick={() => navigate(card.path)}>
                <div className="fc-icon-wrap"><span className="fc-icon">{card.icon}</span></div>
                <div className="fc-body">
                  <div className="fc-subtitle">{card.subtitle}</div>
                  <div className="fc-title">{card.title}</div>
                  <div className="fc-desc">{card.desc}</div>
                </div>
                <div className="fc-footer">
                  <span className="fc-cta" style={{ color: card.color }}>{card.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BEST IN CLASS */}
      {!loading && (
        <section className="home-section">
          <div className="home-inner">
            <div className="section-title-row">
              <div>
                <h2 className="section-heading">Best in Class</h2>
                <p className="section-sub">Category winners from our full catalog</p>
              </div>
              <button className="see-all-btn" onClick={() => navigate('/ranking')}>All Rankings →</button>
            </div>
            <div className="best-grid">
              {bests.map(({ label, phone, val }) => phone && (
                <div className="best-card" key={label} onClick={() => setAboutPhone(phone)}>
                  <div className="bc-label">{label}</div>
                  <div className="bc-brand" style={{ color: BRAND_COLORS[phone.brand] || '#6366f1' }}>{phone.brand}</div>
                  <div className="bc-name">{phone.name}</div>
                  <div className="bc-val">{val}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* TRENDING THIS WEEK */}
      {!loading && trendingWeek.length > 0 && (
        <section className="home-section">
          <div className="home-inner">
            <div className="section-title-row">
              <div>
                <h2 className="section-heading">Trending This Week</h2>
                <p className="section-sub">Ranked by popularity across Indian buyers</p>
              </div>
              <button className="see-all-btn" onClick={() => navigate('/ranking')}>Full Chart →</button>
            </div>
            <ScrollRow phones={trendingWeek} setAboutPhone={setAboutPhone} />
          </div>
        </section>
      )}

      {/* TOP THIS MONTH */}
      {!loading && topMonth.length > 0 && (
        <section className="home-section" style={{ paddingBottom: '4rem' }}>
          <div className="home-inner">
            <div className="section-title-row">
              <div>
                <h2 className="section-heading">Top This Month</h2>
                <p className="section-sub">Best overall spec-for-spec performance</p>
              </div>
              <button className="see-all-btn" onClick={() => navigate('/ranking')}>Full Chart →</button>
            </div>
            <ScrollRow phones={topMonth} setAboutPhone={setAboutPhone} />
          </div>
        </section>
      )}

      {/* FLOATING COMPARE BAR */}
      {compareCount > 0 && (
        <div className="compare-float-bar" onClick={() => navigate('/compare')}>
          <span><strong>{compareCount}</strong> phone{compareCount > 1 ? 's' : ''} ready to compare</span>
          <button>View Comparison →</button>
        </div>
      )}

      {/* BOTTOM NAV */}
      <nav className="home-bottom-nav">
        {NAV_ITEMS.map(c => (
          <button key={c.path} className="hbn-btn" onClick={() => navigate(c.path)}>
            <span>{c.icon}</span>
            <span>{c.title}</span>
          </button>
        ))}
      </nav>

      <Footer />
    </div>
  );
}
