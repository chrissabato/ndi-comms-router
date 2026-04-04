import React from 'react';

export default function MachineSelector({ onSelect }) {
  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        <div style={styles.logo}>NDI COMMS ROUTER</div>
        <h1 style={styles.heading}>Which machine is this?</h1>
        <p style={styles.sub}>This selection is saved and can be changed in Settings</p>
        <div style={styles.cards}>
          <MachineCard
            role="xr18"
            label="XR18 PC"
            description="Behringer XR18 connected via USB (WASAPI multi-channel device)"
            accent="#E8A020"
            icon="🎛"
            onSelect={onSelect}
          />
          <MachineCard
            role="dante"
            label="DANTE PC"
            description="Dante Virtual Soundcard installed (ASIO / WASAPI device)"
            accent="#20B8E8"
            icon="🔊"
            onSelect={onSelect}
          />
        </div>
      </div>
    </div>
  );
}

function MachineCard({ role, label, description, accent, icon, onSelect }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      style={{
        ...styles.card,
        borderColor: hover ? accent : '#2A2A2A',
        background: hover ? `${accent}10` : '#161616',
        transform: hover ? 'translateY(-2px)' : 'none',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onSelect(role)}
    >
      <div style={{ fontSize: 40, marginBottom: 16 }}>{icon}</div>
      <div style={{ ...styles.cardLabel, color: accent }}>{label}</div>
      <div style={styles.cardDesc}>{description}</div>
      <div style={{ ...styles.cardBtn, background: accent, color: '#000' }}>
        Select This Machine
      </div>
    </button>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'var(--bg-base)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  container: {
    textAlign: 'center',
    maxWidth: 700,
    padding: 32,
  },
  logo: {
    fontFamily: "'Barlow', sans-serif",
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: '0.2em',
    color: 'var(--text-dim)',
    marginBottom: 24,
  },
  heading: {
    fontFamily: "'Barlow', sans-serif",
    fontWeight: 700,
    fontSize: 32,
    color: 'var(--text-primary)',
    marginBottom: 10,
  },
  sub: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    marginBottom: 40,
  },
  cards: {
    display: 'flex',
    gap: 20,
    justifyContent: 'center',
  },
  card: {
    flex: 1,
    maxWidth: 280,
    padding: '32px 24px',
    borderRadius: 8,
    border: '1px solid #2A2A2A',
    background: '#161616',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    transition: 'all 0.15s ease',
    fontFamily: "'Barlow', sans-serif",
  },
  cardLabel: {
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: '0.05em',
    marginBottom: 12,
  },
  cardDesc: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    marginBottom: 24,
    minHeight: 50,
  },
  cardBtn: {
    padding: '8px 20px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.05em',
  },
};
