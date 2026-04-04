import React, { useRef, useEffect } from 'react';

const DB_MIN = -60;
const DB_MAX = 0;
const METER_HEIGHT = 120;

function dbToPercent(db) {
  const clamped = Math.max(DB_MIN, Math.min(DB_MAX, db));
  return ((clamped - DB_MIN) / (DB_MAX - DB_MIN)) * 100;
}

function dbToColor(db) {
  if (db >= -3) return '#E84040';
  if (db >= -9) return '#E8A020';
  return '#3DBA6F';
}

function MeterBar({ db, accent }) {
  const pct = dbToPercent(db);
  const color = dbToColor(db);

  return (
    <div style={styles.barTrack}>
      {/* Scale marks */}
      {[-60, -40, -20, -12, -6, -3, 0].map(mark => (
        <div
          key={mark}
          style={{
            ...styles.scaleMark,
            bottom: `${dbToPercent(mark)}%`,
          }}
        />
      ))}
      {/* Filled bar */}
      <div
        style={{
          ...styles.barFill,
          height: `${pct}%`,
          background: color,
          boxShadow: pct > 0 ? `0 0 4px ${color}80` : 'none',
        }}
      />
    </div>
  );
}

export default function VUMeter({ left, right, accent }) {
  // Graceful degradation: if values are non-numeric, show flat
  const safeLeft = typeof left === 'number' && isFinite(left) ? left : -60;
  const safeRight = typeof right === 'number' && isFinite(right) ? right : -60;

  return (
    <div style={styles.container}>
      <div style={styles.bars}>
        <div style={styles.channel}>
          <MeterBar db={safeLeft} accent={accent} />
          <span style={styles.label}>L</span>
        </div>
        <div style={styles.channel}>
          <MeterBar db={safeRight} accent={accent} />
          <span style={styles.label}>R</span>
        </div>
      </div>
      <div style={styles.readout} className="mono">
        <span style={{ color: safeLeft >= -3 ? '#E84040' : 'var(--text-secondary)' }}>
          {safeLeft <= DB_MIN ? '−∞' : `${safeLeft.toFixed(1)}`}
        </span>
        <span style={{ color: 'var(--text-dim)', margin: '0 4px' }}>|</span>
        <span style={{ color: safeRight >= -3 ? '#E84040' : 'var(--text-secondary)' }}>
          {safeRight <= DB_MIN ? '−∞' : `${safeRight.toFixed(1)}`}
        </span>
        <span style={{ color: 'var(--text-dim)', fontSize: 9, marginLeft: 2 }}>dB</span>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  bars: {
    display: 'flex',
    gap: 3,
    height: METER_HEIGHT,
  },
  channel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
  },
  barTrack: {
    width: 14,
    height: METER_HEIGHT - 16,
    background: '#111',
    borderRadius: 2,
    position: 'relative',
    overflow: 'hidden',
    border: '1px solid #222',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: '2px 2px 0 0',
    transition: 'height 0.05s linear',
    transformOrigin: 'bottom',
  },
  scaleMark: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    background: '#222',
    pointerEvents: 'none',
  },
  label: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 9,
    color: 'var(--text-dim)',
    letterSpacing: '0.05em',
  },
  readout: {
    fontSize: 10,
    color: 'var(--text-secondary)',
    textAlign: 'center',
  },
};
