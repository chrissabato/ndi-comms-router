import React from 'react';

export default function ChannelGrid({ channelPairs, selected, onChange, accent }) {
  if (!channelPairs || channelPairs.length === 0) {
    return (
      <div style={styles.empty}>No devices detected — check binary path in Settings</div>
    );
  }

  return (
    <div style={styles.wrapper}>
      {channelPairs.map((pair) => {
        const isSelected = selected === pair.deviceString;
        return (
          <button
            key={pair.deviceString}
            title={pair.deviceString}
            style={{
              ...styles.cell,
              borderColor: isSelected ? accent : 'var(--border)',
              background: isSelected ? `${accent}20` : 'var(--bg-input)',
              color: isSelected ? accent : 'var(--text-secondary)',
              fontWeight: isSelected ? 600 : 400,
            }}
            onClick={() => onChange(pair.deviceString)}
          >
            {pair.label}
          </button>
        );
      })}
    </div>
  );
}

const styles = {
  wrapper: {
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  cell: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 11,
    padding: '7px 10px',
    borderRadius: 3,
    border: '1px solid',
    cursor: 'pointer',
    textAlign: 'left',
    lineHeight: 1.5,
    transition: 'all 0.1s',
    flexShrink: 0,
  },
  empty: {
    color: 'var(--text-dim)',
    fontSize: 11,
    padding: '12px 0',
    fontStyle: 'italic',
  },
};
