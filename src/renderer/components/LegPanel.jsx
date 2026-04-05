import React, { useState, useEffect } from 'react';
import ChannelGrid from './ChannelGrid';
import SourceStatus from './SourceStatus';

const api = window.electronAPI;

export default function LegPanel({
  leg,
  config,
  channelPairs,
  ndiSources,
  status,
  onConfigChange,
}) {
  const isTx = leg === 'tx';
  const accent = isTx ? '#E8A020' : '#20B8E8';
  const legConfig = config[leg] || {};

  const [commandPreview, setCommandPreview] = useState('');

  // Rebuild CLI preview when params change
  useEffect(() => {
    const params = isTx
      ? { streamName: 'Comms TX', device: legConfig.device || '', gain: legConfig.gain ?? 0 }
      : { source: legConfig.source || '', device: legConfig.device || '', gain: legConfig.gain ?? 0 };
    api.buildCommandPreview(leg, params).then(setCommandPreview).catch(() => {});
  }, [leg, legConfig.device, legConfig.gain, legConfig.source, hostname, isTx]);

  async function handleStart() {
    const params = isTx
      ? {
          streamName: 'Comms TX',
          device: legConfig.device || '',
          gain: legConfig.gain ?? 0,
        }
      : {
          source: legConfig.source || '',
          device: legConfig.device || '',
          gain: legConfig.gain ?? 0,
          waitForSource: true,
          autoReconnect: true,
        };
    await api.startLeg(leg, params);
  }

  async function handleStop() {
    await api.stopLeg(leg);
  }

  async function handleDeviceChange(deviceString) {
    await onConfigChange({ [leg]: { device: deviceString } });
  }

  async function handleSourceSelect(sourceName) {
    await onConfigChange({ rx: { source: sourceName } });
  }

  async function handleGainChange(value) {
    await onConfigChange({ [leg]: { gain: value } });
  }

  const isRunning = status === 'running';
  const isWaiting = status === 'waiting';
  const canStart = status === 'idle' || status === 'stopped' || status === 'error';

  const statusLabel = {
    idle: 'IDLE', running: 'RUNNING', waiting: 'WAITING', error: 'ERROR', stopped: 'STOPPED',
  }[status] || status.toUpperCase();

  const statusColor = {
    idle: 'var(--text-dim)', running: '#3DBA6F', waiting: '#E8A020',
    error: '#E84040', stopped: 'var(--text-dim)',
  }[status] || 'var(--text-secondary)';

  return (
    <div style={styles.panel}>
      {/* Panel header */}
      <div style={{ ...styles.header, borderBottomColor: accent }}>
        <div style={styles.headerLeft}>
          <span style={{ ...styles.legLabel, color: accent }}>{isTx ? 'TX' : 'RX'}</span>
          <span style={styles.legDesc}>
            {isTx ? 'Transmit — local audio → NDI' : 'Receive — NDI → local audio'}
          </span>
        </div>
        <div style={styles.headerRight}>
          <span style={{ ...styles.statusDot, color: statusColor }}>&#9679;</span>
          <span style={{ ...styles.statusLabel, color: statusColor }}>{statusLabel}</span>
          {isWaiting && <span style={styles.waitingText}>waiting for source</span>}
        </div>
      </div>

      {/* Panel body */}
      <div style={styles.body}>
        {/* Left column: VU + controls */}
        <div style={styles.leftCol}>
          {/* NDI stream name (TX) or source selector (RX) */}
          {isTx ? (
            <div style={styles.streamName}>
              <label style={styles.fieldLabel}>NDI STREAM NAME</label>
              <div style={styles.streamNameValue} className="mono">
                Comms TX
              </div>
            </div>
          ) : (
            <div style={styles.field}>
              <label style={styles.fieldLabel}>NDI SOURCE</label>
              <SourceStatus
                sources={ndiSources}
                selected={legConfig.source || ''}
                onSelect={handleSourceSelect}
                processStatus={status}
              />
            </div>
          )}

          {/* Gain control */}
          <div style={styles.field}>
            <div style={styles.fieldRow}>
              <label style={styles.fieldLabel}>GAIN</label>
              <span style={{ ...styles.fieldValue, color: accent }} className="mono">
                {legConfig.gain >= 0 ? '+' : ''}{legConfig.gain ?? 0} dB
              </span>
            </div>
            <input
              type="range"
              min={-20}
              max={20}
              step={1}
              value={legConfig.gain ?? 0}
              onChange={e => handleGainChange(Number(e.target.value))}
              disabled={isRunning || isWaiting}
              style={{ ...styles.slider, accentColor: accent, opacity: (isRunning || isWaiting) ? 0.4 : 1, cursor: (isRunning || isWaiting) ? 'not-allowed' : 'pointer' }}
            />
          </div>

          {/* Controls row */}
          <div style={styles.controls}>
            <button
              style={{
                ...styles.startBtn,
                background: canStart ? accent : (isRunning ? '#333' : '#222'),
                color: canStart ? '#000' : (isRunning ? '#fff' : '#555'),
                cursor: canStart || isRunning ? 'pointer' : 'default',
              }}
              onClick={canStart ? handleStart : (isRunning ? handleStop : undefined)}
            >
              {canStart ? `▶ START ${isTx ? 'TX' : 'RX'}` : (isRunning ? '■ STOP' : statusLabel)}
            </button>

          </div>
        </div>

        {/* Right column: device grid */}
        <div style={styles.rightCol}>
          <label style={styles.fieldLabel}>
            {isTx ? 'INPUT DEVICE (capture from)' : 'OUTPUT DEVICE (play to)'}
          </label>
          {legConfig.device && channelPairs.length > 0 && !channelPairs.find(p => p.deviceString === legConfig.device) && (
            <div style={styles.deviceWarning}>
              ⚠ Saved device not found: <span className="mono">{legConfig.device}</span> — select a device below
            </div>
          )}
          <ChannelGrid
            channelPairs={channelPairs}
            selected={legConfig.device || ''}
            onChange={handleDeviceChange}
            accent={accent}
          />
        </div>
      </div>

      {/* CLI command preview */}
      <div style={styles.commandPreview}>
        <span style={styles.commandLabel}>CMD</span>
        <span style={styles.commandText} className="mono">{commandPreview || '—'}</span>
      </div>
    </div>
  );
}

const styles = {
  panel: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 16px', background: 'var(--bg-panel)', borderBottom: '2px solid', flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  legLabel: { fontFamily: "'Barlow', sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: '0.08em' },
  legDesc: { fontSize: 11, color: 'var(--text-secondary)' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 6 },
  statusDot: { fontSize: 8 },
  statusLabel: { fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 500, letterSpacing: '0.08em' },
  waitingText: { fontSize: 10, color: 'var(--text-dim)', marginLeft: 4, fontStyle: 'italic' },
  body: { flex: 1, display: 'flex', gap: 16, padding: '12px 16px', overflow: 'auto' },
  leftCol: { display: 'flex', flexDirection: 'column', gap: 12, width: 200, flexShrink: 0 },
  rightCol: { flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 },
  streamName: { display: 'flex', flexDirection: 'column', gap: 4 },
  streamNameValue: {
    fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-input)',
    border: '1px solid var(--border)', borderRadius: 3, padding: '5px 8px',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  fieldRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: {
    fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
    color: 'var(--text-dim)', fontFamily: "'Barlow', sans-serif",
  },
  fieldValue: { fontFamily: "'DM Mono', monospace", fontSize: 11 },
  slider: { width: '100%', height: 4, cursor: 'pointer', borderRadius: 2 },
  controls: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  startBtn: {
    flex: 1, fontFamily: "'Barlow', sans-serif", fontWeight: 700, fontSize: 11,
    letterSpacing: '0.06em', padding: '7px 8px', borderRadius: 4,
    border: 'none', cursor: 'pointer', transition: 'all 0.1s', minWidth: 0,
  },
  deviceWarning: {
    fontSize: 11,
    color: '#E8A020',
    background: 'rgba(232,160,32,0.08)',
    border: '1px solid rgba(232,160,32,0.3)',
    borderRadius: 3,
    padding: '4px 8px',
    marginBottom: 4,
    lineHeight: 1.4,
  },
  commandPreview: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px',
    background: '#0A0A0A', borderTop: '1px solid var(--border)', flexShrink: 0, overflow: 'hidden',
  },
  commandLabel: { fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-dim)', flexShrink: 0 },
  commandText: { fontSize: 10, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
};
