import React, { useEffect, useRef, useState } from 'react';

function formatTime(ts) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

function entryColor(leg, level) {
  if (level === 'error') return '#E84040';
  if (leg === 'tx') return '#E8A020';
  if (leg === 'rx') return '#20B8E8';
  return '#666';
}

function tagLabel(leg) {
  if (leg === 'tx') return 'TX';
  if (leg === 'rx') return 'RX';
  return 'SYS';
}

export default function ConsoleLog({ logs }) {
  const bottomRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef(null);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'instant' });
    }
  }, [logs, autoScroll]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <span style={styles.headerLabel}>CONSOLE</span>
        <div style={styles.legend}>
          <span style={{ color: '#E8A020' }}>■ TX</span>
          <span style={{ color: '#20B8E8' }}>■ RX</span>
          <span style={{ color: '#666' }}>■ SYS</span>
          <span style={{ color: '#E84040' }}>■ ERR</span>
        </div>
        {!autoScroll && (
          <button
            style={styles.scrollBtn}
            onClick={() => {
              setAutoScroll(true);
              bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            ↓ scroll to bottom
          </button>
        )}
      </div>
      <div style={styles.log} ref={containerRef} onScroll={handleScroll}>
        {logs.length === 0 && (
          <div style={styles.empty}>No log entries yet</div>
        )}
        {logs.map((entry) => (
          <div key={entry.id} style={styles.entry}>
            <span style={styles.timestamp} className="mono">{formatTime(entry.timestamp)}</span>
            <span
              style={{
                ...styles.tag,
                color: entryColor(entry.leg, entry.level),
                borderColor: entryColor(entry.leg, entry.level),
              }}
            >
              {tagLabel(entry.leg)}
            </span>
            <span
              style={{
                ...styles.message,
                color: entry.level === 'error' ? '#E84040'
                  : entry.level === 'success' ? '#3DBA6F'
                  : 'var(--text-secondary)',
              }}
              className="mono"
            >
              {entry.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    height: 160,
    display: 'flex',
    flexDirection: 'column',
    borderTop: '1px solid var(--border)',
    background: '#090909',
    flexShrink: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '4px 12px',
    borderBottom: '1px solid var(--border)',
    background: '#0D0D0D',
    flexShrink: 0,
  },
  headerLabel: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: 'var(--text-dim)',
  },
  legend: {
    display: 'flex',
    gap: 10,
    fontSize: 10,
    fontFamily: "'DM Mono', monospace",
  },
  scrollBtn: {
    marginLeft: 'auto',
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-dim)',
    fontSize: 10,
    padding: '2px 8px',
    borderRadius: 3,
    cursor: 'pointer',
  },
  log: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 0',
  },
  entry: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    padding: '1px 12px',
    fontSize: 11,
  },
  timestamp: {
    color: '#444',
    fontSize: 10,
    flexShrink: 0,
    lineHeight: 1.7,
  },
  tag: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 9,
    fontWeight: 700,
    border: '1px solid',
    borderRadius: 2,
    padding: '0 4px',
    letterSpacing: '0.05em',
    flexShrink: 0,
    lineHeight: 1.6,
  },
  message: {
    fontSize: 11,
    lineHeight: 1.5,
    flex: 1,
    wordBreak: 'break-all',
  },
  empty: {
    color: '#333',
    fontSize: 11,
    padding: '10px 12px',
    fontStyle: 'italic',
  },
};
