export default function PhoneAboutModal({ phone, onClose, fmt, onCompare, isInCompare }) {
  const specs = [
    { label: 'Brand', value: phone.brand },
    { label: 'Model', value: phone.name },
    { label: 'Price (MRP)', value: fmt(phone.price) },
    { label: 'RAM', value: `${phone.ram} GB` },
    { label: 'Camera', value: `${phone.camera_mp} MP` },
    { label: 'Battery', value: `${phone.battery_mah} mAh` },
  ];

  const highlights = [
    phone.ram >= 12    && 'Flagship RAM',
    phone.camera_mp >= 50  && 'High-Res Camera',
    phone.battery_mah >= 5000 && 'Long Battery Life',
    phone.price <= 40000   && 'Great Value',
    phone.price >= 100000  && 'Premium Tier',
  ].filter(Boolean);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <button className="modal-close" onClick={onClose}>×</button>

        <div style={{ marginBottom: '0.5rem', fontSize: '0.8rem', textTransform: 'uppercase',
          letterSpacing: '1px', color: 'var(--accent)', fontWeight: 700 }}>
          {phone.brand}
        </div>
        <h2 className="modal-title">{phone.name}</h2>
        <div className="price" style={{ marginBottom: '0.5rem' }}>{fmt(phone.price)}</div>
        {phone.about && (
          <div style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.95rem', lineHeight: 1.5 }}>
            {phone.about}
          </div>
        )}

        {/* Highlight chips */}
        {highlights.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {highlights.map(h => (
              <span key={h} style={{
                background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                color: '#a5b4fc', borderRadius: '20px', padding: '0.3rem 0.8rem', fontSize: '0.8rem', fontWeight: 600
              }}>{h}</span>
            ))}
          </div>
        )}

        {/* Spec Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {specs.map(({ label, value }) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px'
            }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>{label}</span>
              <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Verdict */}
        <div style={{
          marginTop: '1.5rem', padding: '1rem 1.2rem',
          background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
          borderRadius: '12px', color: '#34d399', fontSize: '0.88rem', lineHeight: 1.6
        }}>
          <strong>AI Verdict:</strong>{' '}
          {phone.match_score != null
            ? `This phone scores ${phone.match_score}% match with your requirements. `
            : ''}
          {phone.ram >= 12 && phone.camera_mp >= 50
            ? 'Excellent choice for power users who need both performance and great photos.'
            : phone.price <= 40000
              ? 'Outstanding value for money — strong specs without breaking the bank.'
              : 'A solid all-rounder that balances performance and price well.'}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          {onCompare && (
            <button
              className={`btn-add-compare ${isInCompare ? 'added' : ''}`}
              style={{ flex: 1, padding: '0.85rem', borderRadius: '12px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', border: 'none',
                background: isInCompare ? 'rgba(52,211,153,0.15)' : 'rgba(99,102,241,0.15)',
                color: isInCompare ? '#34d399' : '#a5b4fc' }}
              onClick={() => onCompare(phone)}
            >
              {isInCompare ? '✓ In Compare' : '+ Add to Compare'}
            </button>
          )}
          <button className="btn-primary" style={{ flex: 1 }} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
