import React, { useState, useEffect, useCallback, useRef } from 'react';
import MachineSelector from './components/MachineSelector';
import LegPanel from './components/LegPanel';
import ConsoleLog from './components/ConsoleLog';
import Settings from './components/Settings';
import SignalFlow from './components/SignalFlow';

const api = window.electronAPI;

export default function App() {
  const [config, setConfigState] = useState(null);
  const [hostname, setHostname] = useState('');
  const [audioDevices, setAudioDevices] = useState({ channelPairs: [], systemDevices: [] });
  const [ndiSources, setNdiSources] = useState([]);
  const [processStatus, setProcessStatus] = useState({ tx: 'idle', rx: 'idle' });
  const [vuLevels, setVuLevels] = useState({ tx: { left: -60, right: -60 }, rx: { left: -60, right: -60 } });
  const [logs, setLogs] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [linkLatency, setLinkLatency] = useState(false);

  const logsRef = useRef([]);

  // Bootstrap
  useEffect(() => {
    async function init() {
      const [cfg, hn] = await Promise.all([api.getConfig(), api.getHostname()]);
      setConfigState(cfg);
      setHostname(hn);

      if (cfg.machineRole) {
        const devs = await api.getAudioDevices();
        setAudioDevices(devs);
      }

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

    const unsubVu = api.onVuLevels(({ leg, left, right }) => {
      setVuLevels(prev => ({ ...prev, [leg]: { left, right } }));
    });

    return () => {
      unsubLog();
      unsubSources();
      unsubStatus();
      unsubVu();
    };
  }, []);

  const handleRoleSelect = useCallback(async (role) => {
    const cfg = await api.setConfig({ machineRole: role });
    setConfigState(cfg);
    const devs = await api.getAudioDevices();
    setAudioDevices(devs);
  }, []);

  const updateConfig = useCallback(async (updates) => {
    const cfg = await api.setConfig(updates);
    setConfigState(cfg);
    return cfg;
  }, []);

  const handleStartBoth = useCallback(async () => {
    const txParams = buildTxParams(config, hostname);
    const rxParams = buildRxParams(config);
    await api.startBoth(txParams, rxParams);
  }, [config, hostname]);

  const handleStopAll = useCallback(async () => {
    await api.stopAll();
  }, []);

  const handleLatencyChange = useCallback(async (leg, value) => {
    const update = { [leg]: { latency: value } };
    if (linkLatency) {
      update.tx = { latency: value };
      update.rx = { latency: value };
    }
    await updateConfig(update);
  }, [linkLatency, updateConfig]);

  if (!config) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#555' }}>Initialising...</div>;
  }

  if (!config.machineRole) {
    return <MachineSelector onSelect={handleRoleSelect} />;
  }

  const bothRunning = processStatus.tx === 'running' && processStatus.rx === 'running';
  const anyRunning = processStatus.tx !== 'idle' || processStatus.rx !== 'idle';

  return (
    <div style={styles.root}>
      {/* Titlebar */}
      <div className="titlebar" style={styles.titlebar}>
        <span style={styles.titlebarTitle}>NDI COMMS ROUTER</span>
        <span style={styles.titlebarRole}>{config.machineRole === 'xr18' ? 'XR18 PC' : 'DANTE PC'}</span>
        <span style={styles.titlebarHost} className="mono">{hostname}</span>
        <div style={styles.titlebarActions}>
          <button style={styles.titlebarBtn} onClick={() => setShowSettings(true)}>&#9881;</button>
        </div>
      </div>

      {/* Signal flow diagram */}
      <SignalFlow
        machineRole={config.machineRole}
        txStatus={processStatus.tx}
        rxStatus={processStatus.rx}
        hostname={hostname}
        remoteSource={config.rx?.source}
      />

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
        <label style={styles.linkLatency}>
          <input
            type="checkbox"
            checked={linkLatency}
            onChange={e => setLinkLatency(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          Link latency
        </label>
      </div>

      {/* Main content */}
      <div style={styles.content}>
        <div style={styles.legs}>
          <LegPanel
            leg="tx"
            config={config}
            hostname={hostname}
            channelPairs={audioDevices.channelPairs}
            ndiSources={ndiSources}
            status={processStatus.tx}
            vuLevels={vuLevels.tx}
            onConfigChange={updateConfig}
            onLatencyChange={(v) => handleLatencyChange('tx', v)}
          />
          <div style={styles.legDivider} />
          <LegPanel
            leg="rx"
            config={config}
            hostname={hostname}
            channelPairs={audioDevices.channelPairs}
            ndiSources={ndiSources}
            status={processStatus.rx}
            vuLevels={vuLevels.rx}
            onConfigChange={updateConfig}
            onLatencyChange={(v) => handleLatencyChange('rx', v)}
          />
        </div>
        <ConsoleLog logs={logs} />
      </div>

      {showSettings && (
        <Settings
          config={config}
          onSave={async (updates) => {
            await updateConfig(updates);
            setShowSettings(false);
            // Reload audio devices if role changed
            if (updates.machineRole && updates.machineRole !== config.machineRole) {
              const devs = await api.getAudioDevices();
              setAudioDevices(devs);
            }
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

function buildTxParams(config, hostname) {
  const safeName = hostname.toUpperCase().replace(/[^A-Z0-9\-]/g, '-');
  return {
    streamName: `${safeName} . Comms TX`,
    device: config.tx?.device || '',
    gain: config.tx?.gain ?? 0,
    latency: config.tx?.latency ?? 12,
    networkInterface: config.networkInterface,
  };
}

function buildRxParams(config) {
  return {
    source: config.rx?.source || '',
    device: config.rx?.device || '',
    gain: config.rx?.gain ?? 0,
    latency: config.rx?.latency ?? 12,
    waitForSource: true,
    autoReconnect: true,
    networkInterface: config.networkInterface,
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
  titlebarRole: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--tx)',
    background: 'rgba(232,160,32,0.12)',
    padding: '2px 8px',
    borderRadius: 3,
    letterSpacing: '0.05em',
  },
  titlebarHost: {
    fontSize: 11,
    color: 'var(--text-secondary)',
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
    fontSize: 16,
    padding: '2px 6px',
    borderRadius: 4,
    WebkitAppRegion: 'no-drag',
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
  linkLatency: {
    marginLeft: 16,
    fontSize: 12,
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
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
