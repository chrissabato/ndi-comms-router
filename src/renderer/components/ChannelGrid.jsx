import React from 'react';

export default function ChannelGrid({ channelPairs, selected, onChange, accent }) {
  if (!channelPairs || channelPairs.length === 0) {
    return (
      <div style={styles.empty}>No channels detected</div>
    );
  }

  return (
    <div style={styles.grid}>
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 4,
  },
  cell: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 10,
    padding: '5px 4px',
    borderRadius: 3,
    border: '1px solid',
    cursor: 'pointer',
    textAlign: 'center',
    lineHeight: 1.2,
    transition: 'all 0.1s',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  empty: {
    color: 'var(--text-dim)',
    fontSize: 12,
    textAlign: 'center',
    padding: '12px 0',
    fontStyle: 'italic',
  },
};
