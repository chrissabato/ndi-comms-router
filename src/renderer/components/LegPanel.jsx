import React, { useState, useEffect } from 'react';
import ChannelGrid from './ChannelGrid';
import VUMeter from './VUMeter';
import SourceStatus from './SourceStatus';

const api = window.electronAPI;
const LATENCY_OPTIONS = [4, 8, 12, 16, 24, 32, 48, 64];

export default function LegPanel({
  leg,
  config,
  hostname,
  channelPairs,
  ndiSources,
  status,
  vuLevels,
  onConfigChange,
  onLatencyChange,
}) {
  const isTx = leg === 'tx';
  const accent = isTx ? '#E8A020' : '#20B8E8';
  const legConfig = config[leg] || {};

  const [commandPreview, setCommandPreview] = useState('');

  // Rebuild CLI preview when params change
  useEffect(() => {
    const safeName = hostname.toUpperCase().replace(/[^A-Z0-9\-]/g, '-');
    const params = isTx
      ? {
          streamName: `${safeName} . Comms TX`,
          device: legConfig.device || '',
          gain: legConfig.gain ?? 0,
          latency: legConfig.latency ?? 12,
        }
      : {
          source: legConfig.source || '',
          device: legConfig.device || '',
          gain: legConfig.gain ?? 0,
          latency: legConfig.latency ?? 12,
        };
    api.buildCommandPreview(leg, params).then(setCommandPreview).catch(() => {});
  }, [leg, legConfig.device, legConfig.gain, legConfig.latency, legConfig.source, hostname, isTx]);

  async function handleStart() {
    const safeName = hostname.toUpperCase().replace(/[^A-Z0-9\-]/g, '-');
    const params = isTx
      ? {
          streamName: `${safeName} . Comms TX`,
          device: legConfig.device || '',
          gain: legConfig.gain ?? 0,
          latency: legConfig.latency ?? 12,
          networkInterface: config.networkInterface,
        }
      : {
          source: legConfig.source || '',
          device: legConfig.device || '',
          gain: legConfig.gain ?? 0,
          latency: legConfig.latency ?? 12,
          waitForSource: true,
          autoReconnect: true,
          networkInterface: config.networkInterface,
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

  async function handleLatency(value) {
    onLatencyChange(value);
  }

  async function handleMuteToggle() {
    await onConfigChange({ [leg]: { muted: !legConfig.muted } });
  }

  const isRunning = status === 'running';
  const isWaiting = status === 'waiting';
  const isError = status === 'error';
  const canStart = status === 'idle' || status === 'stopped' || status === 'error';

  const statusLabel = {
    idle: 'IDLE',
    running: 'RUNNING',
    waiting: 'WAITING',
    error: 'ERROR',
    stopped: 'STOPPED',
  }[status] || status.toUpperCase();

  const statusColor = {
    idle: 'var(--text-dim)',
    running: '#3DBA6F',
    waiting: '#E8A020',
    error: '#E84040',
    stopped: 'var(--text-dim)',
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
          <VUMeter
            left={vuLevels?.left ?? -60}
            right={vuLevels?.right ?? -60}
            accent={accent}
          />

          {/* NDI stream name (TX) or source selector (RX) */}
          {isTx ? (
            <div style={styles.streamName}>
              <label style={styles.fieldLabel}>NDI STREAM NAME</label>
              <div style={styles.streamNameValue} className="mono">
                {hostname.toUpperCase().replace(/[^A-Z0-9\-]/g, '-')} . Comms TX
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
              style={{ ...styles.slider, accentColor: accent }}
            />
          </div>

          {/* Latency picker */}
          <div style={styles.field}>
            <label style={styles.fieldLabel}>BUFFER LATENCY</label>
            <div style={styles.latencyGrid}>
              {LATENCY_OPTIONS.map(ms => (
                <button
                  key={ms}
                  style={{
                    ...styles.latencyBtn,
                    borderColor: legConfig.latency === ms ? accent : 'var(--border)',
                    color: legConfig.latency === ms ? accent : 'var(--text-secondary)',
                    background: legConfig.latency === ms ? `${accent}18` : 'var(--bg-input)',
                    fontWeight: legConfig.latency === ms ? 600 : 400,
                  }}
                  onClick={() => handleLatency(ms)}
                >
                  {ms}ms
                </button>
              ))}
            </div>
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
              {canStart ? `▶ START ${isTx ? 'TX' : 'RX'}` : (isRunning ? `■ STOP` : statusLabel)}
            </button>

            <button
              style={{
                ...styles.muteBtn,
                borderColor: legConfig.muted ? accent : 'var(--border)',
                color: legConfig.muted ? accent : 'var(--text-secondary)',
                background: legConfig.muted ? `${accent}15` : 'var(--bg-input)',
              }}
              onClick={handleMuteToggle}
              title="Mute (silences without stopping process)"
            >
              {legConfig.muted ? '🔇 MUTED' : '🔊 MUTE'}
            </button>
          </div>
        </div>

        {/* Right column: channel grid */}
        <div style={styles.rightCol}>
          <label style={styles.fieldLabel}>LOCAL AUDIO DEVICE — CHANNEL PAIR</label>
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
  panel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    background: 'var(--bg-panel)',
    borderBottom: '2px solid',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  legLabel: {
    fontFamily: "'Barlow', sans-serif",
    fontWeight: 700,
    fontSize: 18,
    letterSpacing: '0.08em',
  },
  legDesc: {
    fontSize: 11,
    color: 'var(--text-secondary)',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    fontSize: 8,
  },
  statusLabel: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '0.08em',
  },
  waitingText: {
    fontSize: 10,
    color: 'var(--text-dim)',
    marginLeft: 4,
    fontStyle: 'italic',
  },
  body: {
    flex: 1,
    display: 'flex',
    gap: 16,
    padding: '12px 16px',
    overflow: 'auto',
  },
  leftCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    width: 180,
    flexShrink: 0,
  },
  rightCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minWidth: 0,
  },
  streamName: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  streamNameValue: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 3,
    padding: '5px 8px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  fieldRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: 'var(--text-dim)',
    fontFamily: "'Barlow', sans-serif",
  },
  fieldValue: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 11,
  },
  slider: {
    width: '100%',
    height: 4,
    cursor: 'pointer',
    borderRadius: 2,
  },
  latencyGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 3,
  },
  latencyBtn: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 10,
    padding: '4px 2px',
    borderRadius: 3,
    border: '1px solid',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.1s',
  },
  controls: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  startBtn: {
    flex: 1,
    fontFamily: "'Barlow', sans-serif",
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: '0.06em',
    padding: '7px 8px',
    borderRadius: 4,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.1s',
    minWidth: 0,
  },
  muteBtn: {
    fontFamily: "'Barlow', sans-serif",
    fontWeight: 600,
    fontSize: 10,
    padding: '7px 8px',
    borderRadius: 4,
    border: '1px solid',
    cursor: 'pointer',
    transition: 'all 0.1s',
    whiteSpace: 'nowrap',
    background: 'var(--bg-input)',
  },
  commandPreview: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 16px',
    background: '#0A0A0A',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
    overflow: 'hidden',
  },
  commandLabel: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: 'var(--text-dim)',
    flexShrink: 0,
  },
  commandText: {
    fontSize: 10,
    color: '#555',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};
