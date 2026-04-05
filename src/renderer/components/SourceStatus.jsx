import React, { useState } from 'react';

const api = window.electronAPI;

export default function SourceStatus({ sources, selected, onSelect, processStatus }) {
  const [manualInput, setManualInput] = useState('');

  function getSourceState(sourceName) {
    if (!sourceName) return 'scanning';
    if (processStatus === 'running') {
      const active = sources.find(s => s.name === sourceName);
      if (active) return 'connected';
    }
    const found = sources.find(s => s.name === sourceName);
    return found ? 'available' : 'scanning';
  }

  async function handleAddManual(e) {
    e.preventDefault();
    const name = manualInput.trim();
    if (!name) return;
    await api.addManualSource(name);
    onSelect(name);
    setManualInput('');
  }

  async function handleRemove(name, e) {
    e.stopPropagation();
    await api.removeManualSource(name);
    if (selected === name) onSelect('');
  }

  const autoSources = sources.filter(s => !s.manual);
  const manualSources = sources.filter(s => s.manual);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerLabel}>NDI SOURCES</span>
        <span style={styles.count} className="mono">
          {autoSources.length > 0 ? `${autoSources.length} discovered` : 'none discovered'}
        </span>
      </div>

      <div style={styles.list}>
        {sources.length === 0 && (
          <div style={styles.empty}>
            <span className="pulse-amber">&#9679;</span>
            <span style={{ marginLeft: 6 }}>Scanning... or add source manually below</span>
          </div>
        )}

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
              onRemove={src.manual ? (e) => handleRemove(src.name, e) : null}
            />
          );
        })}
      </div>

      {/* Manual entry */}
      <form style={styles.manualForm} onSubmit={handleAddManual}>
        <input
          type="text"
          value={manualInput}
          onChange={e => setManualInput(e.target.value)}
          placeholder='e.g. XR18-PC . Comms TX'
          style={styles.manualInput}
          className="mono"
          spellCheck={false}
        />
        <button type="submit" style={styles.manualBtn} disabled={!manualInput.trim()}>
          Add
        </button>
      </form>

      {selected && !sources.find(s => s.name === selected) && (
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

function SourceRow({ source, state, isSelected, onSelect, onRemove }) {
  const dot = {
    scanning:  { color: '#E8A020', pulse: true,  label: 'Scanning'   },
    available: { color: '#888',    pulse: false, label: 'Available'  },
    connected: { color: '#3DBA6F', pulse: false, label: 'Connected'  },
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
        className={dot.pulse ? 'pulse-amber' : ''}
        style={{ color: dot.color, fontSize: 8, marginRight: 8, flexShrink: 0 }}
      >
        &#9679;
      </span>
      <div style={styles.rowInfo}>
        <span style={styles.rowName} className="mono">
          {source.name}
          {source.manual && <span style={styles.manualTag}>manual</span>}
        </span>
        {source.ip && <span style={styles.rowIp} className="mono">{source.ip}</span>}
      </div>
      <span style={{ ...styles.rowState, color: dot.color }}>{dot.label}</span>
      {onRemove && (
        <span
          style={styles.removeBtn}
          onClick={onRemove}
          title="Remove"
        >✕</span>
      )}
    </button>
  );
}

const styles = {
  container: {
    background: 'var(--bg-input)',
    borderRadius: 4,
    border: '1px solid var(--border)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '5px 10px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-card)',
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: 'var(--text-secondary)',
  },
  count: { fontSize: 10, color: 'var(--text-dim)' },
  list: { flex: 1, overflowY: 'scroll', scrollbarWidth: 'auto', scrollbarColor: '#444 #1a1a1a' },
  empty: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 10px',
    fontSize: 11,
    color: 'var(--text-secondary)',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '5px 10px',
    background: 'transparent',
    border: '1px solid transparent',
    cursor: 'pointer',
    textAlign: 'left',
  },
  rowInfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  rowName: {
    fontSize: 11,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  manualTag: {
    fontSize: 9,
    color: 'var(--text-dim)',
    border: '1px solid var(--border)',
    borderRadius: 2,
    padding: '0 3px',
  },
  rowIp: { fontSize: 10, color: 'var(--text-dim)' },
  rowState: { fontSize: 10, marginLeft: 8, flexShrink: 0 },
  removeBtn: {
    fontSize: 11,
    color: 'var(--text-dim)',
    marginLeft: 6,
    cursor: 'pointer',
    padding: '0 2px',
    flexShrink: 0,
  },
  manualForm: {
    display: 'flex',
    gap: 4,
    padding: '5px 8px',
    borderTop: '1px solid var(--border)',
  },
  manualInput: {
    flex: 1,
    background: 'var(--bg-base)',
    border: '1px solid var(--border)',
    borderRadius: 3,
    color: 'var(--text-primary)',
    padding: '4px 7px',
    fontSize: 11,
    outline: 'none',
    minWidth: 0,
  },
  manualBtn: {
    background: 'var(--rx-dim)',
    border: '1px solid var(--rx)',
    color: 'var(--rx)',
    borderRadius: 3,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
  notFound: {
    display: 'flex',
    alignItems: 'center',
    padding: '5px 10px',
    borderTop: '1px solid var(--border)',
    fontSize: 11,
    color: 'var(--text-secondary)',
  },
};
