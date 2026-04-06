import React, { useState, useEffect, useCallback, useRef } from 'react';
import LegPanel from './components/LegPanel';
import ConsoleLog from './components/ConsoleLog';
import Settings from './components/Settings';

const api = window.electronAPI;

export default function App() {
  const [config, setConfigState] = useState(null);
  const [hostname, setHostname] = useState('');
  const [version, setVersion] = useState('');
  const [audioDevices, setAudioDevices] = useState({ channelPairs: [], systemDevices: [] });
  const [ndiSources, setNdiSources] = useState([]);
  const [processStatus, setProcessStatus] = useState({ tx: 'idle', rx: 'idle' });
  const [logs, setLogs] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null);
  const [binaryMissing, setBinaryMissing] = useState(false);
  const [duplexPreview, setDuplexPreview] = useState('');

  const logsRef = useRef([]);

  // Bootstrap
  useEffect(() => {
    async function init() {
      const [cfg, hn, ver, bin] = await Promise.all([api.getConfig(), api.getHostname(), api.getVersion(), api.checkBinary()]);
      setVersion(ver);
      setConfigState(cfg);
      setHostname(hn);
      if (!bin.found) setBinaryMissing(true);

      const devs = await api.getAudioDevices();
      setAudioDevices(devs);

      const sources = await api.getNdiSources();
      setNdiSources(sources);

      const status = await api.getProcessStatus();
      setProcessStatus(status);
    }
    init();
  }, []);

  // Event subscriptions
  useEffect(() => {
    const unsubLog = api.onLog((data) => {
      const entry = { ...data, id: Date.now() + Math.random() };
      logsRef.current = [...logsRef.current.slice(-299), entry];
      setLogs([...logsRef.current]);
    });

    const unsubSources = api.onNdiSources((sources) => {
      setNdiSources(sources);
    });

    const unsubStatus = api.onProcessStatus(({ leg, status }) => {
      setProcessStatus(prev => ({ ...prev, [leg]: status }));
    });

    const unsubUpdater = api.onUpdaterStatus((data) => {
      // Only surface states the user needs to act on or be aware of
      if (['available', 'downloading', 'ready', 'error'].includes(data.status)) {
        setUpdateStatus(data);
      }
    });

    return () => {
      unsubLog();
      unsubSources();
      unsubStatus();
      unsubUpdater();
    };
  }, []);

  const updateConfig = useCallback(async (updates) => {
    const cfg = await api.setConfig(updates);
    setConfigState(cfg);
    return cfg;
  }, []);

  // Rebuild full-duplex command preview when config changes
  useEffect(() => {
    if (!config) return;
    api.buildBothCommandPreview(buildTxParams(config), buildRxParams(config))
      .then(setDuplexPreview).catch(() => {});
  }, [config]);

  const handleStartBoth = useCallback(async () => {
    const txParams = buildTxParams(config);
    const rxParams = buildRxParams(config);
    await api.startBoth(txParams, rxParams);
  }, [config]);

  const handleStopAll = useCallback(async () => {
    await api.stopAll();
  }, []);

  if (!config) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#555' }}>Initialising...</div>;
  }

  const bothRunning = processStatus.tx === 'running' && processStatus.rx === 'running';
  const anyRunning = processStatus.tx !== 'idle' || processStatus.rx !== 'idle';

  return (
    <div style={styles.root}>
      {/* Titlebar */}
      <div className="titlebar" style={styles.titlebar}>
        <span style={styles.titlebarTitle}>NDI COMMS ROUTER</span>
        <span style={styles.titlebarHost} className="mono">{hostname}</span>
        {version && <span style={styles.titlebarVersion} className="mono">v{version}</span>}
        <div style={styles.titlebarActions}>
          <button style={styles.titlebarBtn} onClick={() => setShowSettings(true)} title="Settings">&#9881;</button>
          <button style={styles.titlebarBtn} onClick={() => api.windowMinimize()} title="Minimize">&#8211;</button>
          <button style={styles.titlebarBtn} onClick={() => api.windowMaximize()} title="Maximize">&#9633;</button>
          <button style={{ ...styles.titlebarBtn, ...styles.titlebarClose }} onClick={() => api.windowClose()} title="Close">&#10005;</button>
        </div>
      </div>

      {/* Binary missing warning */}
      {binaryMissing && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '5px 16px',
          background: 'rgba(232,64,64,0.12)',
          borderBottom: '1px solid #E8404040',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, color: '#E84040', flex: 1 }}>
            NDI Free Audio binary not found — check the path in Settings
          </span>
          <button
            onClick={() => setShowSettings(true)}
            style={{
              background: '#E84040', border: 'none', color: '#fff',
              fontSize: 11, fontWeight: 700, padding: '3px 12px',
              borderRadius: 3, cursor: 'pointer',
            }}
          >
            Open Settings
          </button>
        </div>
      )}

      {/* Update notification banner */}
      {updateStatus && <UpdateBanner status={updateStatus} onDismiss={() => setUpdateStatus(null)} />}

      {/* Master controls */}
      <div style={styles.masterControls}>
        <button
          style={{ ...styles.masterBtn, ...(bothRunning ? styles.masterBtnStop : styles.masterBtnStart) }}
          onClick={bothRunning ? handleStopAll : handleStartBoth}
        >
          {bothRunning ? '■  STOP ALL' : '▶  START FULL-DUPLEX'}
        </button>
        {anyRunning && !bothRunning && (
          <button style={{ ...styles.masterBtn, ...styles.masterBtnStop, marginLeft: 8 }} onClick={handleStopAll}>
            ■  STOP ALL
          </button>
        )}
      </div>

      {/* Main content */}
      <div style={styles.content}>
        <div style={styles.legs}>
          <LegPanel
            leg="tx"
            config={config}
            channelPairs={toChannelPairs(audioDevices.inputDevices)}
            ndiSources={ndiSources}
            status={processStatus.tx}
            onConfigChange={updateConfig}
            duplexPreview={duplexPreview}
            bothRunning={bothRunning}
          />
          <div style={styles.legDivider} />
          <LegPanel
            leg="rx"
            config={config}
            channelPairs={toChannelPairs(audioDevices.outputDevices)}
            ndiSources={ndiSources}
            status={processStatus.rx}
            onConfigChange={updateConfig}
            duplexPreview={duplexPreview}
            bothRunning={bothRunning}
          />
        </div>
        <ConsoleLog logs={logs} />
      </div>

      {showSettings && (
        <Settings
          config={config}
          onSave={async (updates) => {
            await updateConfig(updates);
            const bin = await api.checkBinary();
            setBinaryMissing(!bin.found);
            setShowSettings(false);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

function UpdateBanner({ status, onDismiss }) {
  const messages = {
    available: `Update v${status.version} available — downloading...`,
    downloading: `Downloading update... ${status.percent ?? 0}%`,
    ready: `Update v${status.version} ready — will install on next quit`,
    error: `Update check failed: ${status.message}`,
  };

  const isReady = status.status === 'ready';
  const isError = status.status === 'error';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '5px 16px',
      background: isError ? 'rgba(232,64,64,0.12)' : 'rgba(61,186,111,0.12)',
      borderBottom: `1px solid ${isError ? '#E84040' : '#3DBA6F'}40`,
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 11, color: isError ? '#E84040' : '#3DBA6F', flex: 1 }}>
        {messages[status.status]}
      </span>
      {isReady && (
        <button
          onClick={() => api.installUpdate()}
          style={{
            background: '#3DBA6F', border: 'none', color: '#000',
            fontSize: 11, fontWeight: 700, padding: '3px 12px',
            borderRadius: 3, cursor: 'pointer',
          }}
        >
          Restart &amp; Install
        </button>
      )}
      <button
        onClick={onDismiss}
        style={{
          background: 'none', border: 'none', color: '#555',
          fontSize: 14, cursor: 'pointer', padding: '0 4px',
        }}
      >
        ✕
      </button>
    </div>
  );
}

function toChannelPairs(deviceNames) {
  if (!deviceNames) return [];
  return deviceNames.map(name => ({ label: name, deviceString: name }));
}

function buildTxParams(config) {
  return {
    streamName: config.tx?.streamName || 'Comms TX',
    device: config.tx?.device || '',
    gain: config.tx?.gain ?? 0,
  };
}

function buildRxParams(config) {
  return {
    source: config.rx?.source || '',
    device: config.rx?.device || '',
    gain: config.rx?.gain ?? 0,
    waitForSource: true,
    autoReconnect: true,
  };
}

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: 'var(--bg-base)',
    overflow: 'hidden',
  },
  titlebar: {
    height: 36,
    background: '#0A0A0A',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    gap: 12,
    flexShrink: 0,
  },
  titlebarTitle: {
    fontFamily: "'Barlow', sans-serif",
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: '0.1em',
    color: 'var(--text-primary)',
  },
  titlebarHost: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    marginLeft: 4,
  },
  titlebarVersion: {
    fontSize: 10,
    color: 'var(--text-dim)',
    marginLeft: 4,
  },
  titlebarActions: {
    marginLeft: 'auto',
  },
  titlebarBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: 14,
    padding: '4px 10px',
    borderRadius: 0,
    WebkitAppRegion: 'no-drag',
    lineHeight: 1,
  },
  titlebarClose: {
    fontSize: 12,
    color: '#888',
    marginRight: -12,
  },
  masterControls: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
    background: 'var(--bg-panel)',
    borderBottom: '1px solid var(--border)',
    gap: 8,
    flexShrink: 0,
  },
  masterBtn: {
    fontFamily: "'Barlow', sans-serif",
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: '0.08em',
    padding: '6px 20px',
    borderRadius: 4,
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  masterBtnStart: {
    background: 'var(--success)',
    color: '#000',
  },
  masterBtnStop: {
    background: 'var(--error)',
    color: '#fff',
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  legs: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    minHeight: 0,
  },
  legDivider: {
    width: 1,
    background: 'var(--border)',
    flexShrink: 0,
  },
};
