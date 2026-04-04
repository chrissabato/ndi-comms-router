import React from 'react';

// source: { name, hostname, streamName, ip }
// state: 'scanning' | 'available' | 'connected'
export default function SourceStatus({ sources, selected, onSelect, processStatus }) {
  function getSourceState(sourceName) {
    if (processStatus === 'running') {
      const active = sources.find(s => s.name === sourceName || s.name.includes(sourceName));
      if (active) return 'connected';
    }
    const found = sources.find(s => s.name === sourceName || s.name.includes(sourceName));
    return found ? 'available' : 'scanning';
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerLabel}>NDI SOURCES</span>
        <span style={styles.count} className="mono">{sources.length} found</span>
      </div>
      {sources.length === 0 ? (
        <div style={styles.scanning}>
          <span className="pulse-amber">&#9679;</span>
          <span style={{ marginLeft: 6 }}>Scanning for sources...</span>
        </div>
      ) : (
        <div style={styles.list}>
          {sources.map((src) => {
            const state = getSourceState(src.name);
            const isSelected = selected === src.name;
            return (
              <SourceRow
                key={src.name}
                source={src}
                state={state}
                isSelected={isSelected}
                onSelect={() => onSelect(src.name)}
              />
            );
          })}
        </div>
      )}
      {selected && !sources.find(s => s.name === selected || s.name.includes(selected)) && (
        <div style={styles.notFound}>
          <span className="pulse-amber">&#9679;</span>
          <span style={{ marginLeft: 6, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
            Waiting: {selected}
          </span>
        </div>
      )}
    </div>
  );
}

function SourceRow({ source, state, isSelected, onSelect }) {
  const dot = {
    scanning: { color: '#E8A020', className: 'pulse-amber', label: 'Scanning' },
    available: { color: '#888', className: '', label: 'Available' },
    connected: { color: '#3DBA6F', className: '', label: 'Connected' },
  }[state];

  return (
    <button
      style={{
        ...styles.row,
        borderColor: isSelected ? 'var(--rx)' : 'transparent',
        background: isSelected ? 'rgba(32,184,232,0.08)' : 'transparent',
      }}
      onClick={onSelect}
    >
      <span
        className={dot.className}
        style={{ color: dot.color, fontSize: 8, marginRight: 8, flexShrink: 0 }}
      >
        &#9679;
      </span>
      <div style={styles.rowInfo}>
        <span style={styles.rowName} className="mono">{source.name}</span>
        {source.ip && (
          <span style={styles.rowIp} className="mono">{source.ip}</span>
        )}
      </div>
      <span style={{ ...styles.rowState, color: dot.color }}>{dot.label}</span>
    </button>
  );
}

const styles = {
  container: {
    background: 'var(--bg-input)',
    borderRadius: 4,
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 10px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-card)',
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: 'var(--text-secondary)',
  },
  count: {
    fontSize: 10,
    color: 'var(--text-dim)',
  },
  scanning: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 12px',
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  list: {
    maxHeight: 120,
    overflowY: 'auto',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '6px 10px',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 0,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.1s',
  },
  rowInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  rowName: {
    fontSize: 11,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowIp: {
    fontSize: 10,
    color: 'var(--text-dim)',
  },
  rowState: {
    fontSize: 10,
    marginLeft: 8,
    flexShrink: 0,
  },
  notFound: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 10px',
    borderTop: '1px solid var(--border)',
    fontSize: 11,
    color: 'var(--text-secondary)',
  },
};
