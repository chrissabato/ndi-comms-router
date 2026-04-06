import React, { useState } from 'react';

const api = window.electronAPI;

export default function Settings({ config, onSave, onClose }) {
  const [form, setForm] = useState({
    binaryPath: config.binaryPath || 'ndi-free-audio',
    machineRole: config.machineRole || 'xr18',
    autoStart: config.autoStart || false,
    networkInterface: config.networkInterface || 'auto',
  });
  const [saving, setSaving] = useState(false);
  const [updateState, setUpdateState] = useState(null); // null | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'ready' | 'error'
  const [updateInfo, setUpdateInfo] = useState('');

  function update(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleCheckUpdates() {
    setUpdateState('checking');
    setUpdateInfo('');
    const unsub = api.onUpdaterStatus((data) => {
      setUpdateState(data.status);
      if (data.status === 'available' || data.status === 'ready') setUpdateInfo(data.version || '');
      if (data.status === 'downloading') setUpdateInfo(`${data.percent ?? 0}%`);
      if (data.status === 'error') setUpdateInfo(data.message || '');
      if (['up-to-date', 'ready', 'error'].includes(data.status)) unsub();
    });
    await api.checkForUpdates();
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.panel}>
        <div style={styles.header}>
          <h2 style={styles.title}>Settings</h2>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.body}>
          {/* Binary path */}
          <div style={styles.field}>
            <label style={styles.label}>ndi-free-audio Binary Path</label>
            <p style={styles.hint}>Full path to the ndi-free-audio executable</p>
            <input
              type="text"
              value={form.binaryPath}
              onChange={e => update('binaryPath', e.target.value)}
              style={styles.input}
              className="mono"
              placeholder="e.g. C:\Program Files\NDI Free Audio\ndi-free-audio.exe"
            />
          </div>

          {/* Machine role */}
          <div style={styles.field}>
            <label style={styles.label}>Machine Role</label>
            <p style={styles.hint}>Changes device enumeration and channel grid layout</p>
            <div style={styles.roleRow}>
              <RoleOption
                value="xr18"
                selected={form.machineRole === 'xr18'}
                label="XR18 PC"
                onSelect={() => update('machineRole', 'xr18')}
              />
              <RoleOption
                value="dante"
                selected={form.machineRole === 'dante'}
                label="DANTE PC"
                onSelect={() => update('machineRole', 'dante')}
              />
            </div>
          </div>

          {/* Network interface */}
          <div style={styles.field}>
            <label style={styles.label}>Network Interface</label>
            <p style={styles.hint}>For multi-NIC machines — restrict NDI to a specific interface</p>
            <input
              type="text"
              value={form.networkInterface}
              onChange={e => update('networkInterface', e.target.value)}
              style={styles.input}
              className="mono"
              placeholder="auto"
            />
          </div>

          {/* Auto-start */}
          <div style={styles.field}>
            <label style={styles.checkLabel}>
              <input
                type="checkbox"
                checked={form.autoStart}
                onChange={e => update('autoStart', e.target.checked)}
                style={{ marginRight: 8 }}
              />
              Auto-start both legs on launch
            </label>
            <p style={styles.hint}>Starts TX and RX immediately when the app opens, using saved device settings</p>
          </div>

          {/* Updates */}
          <div style={styles.field}>
            <label style={styles.label}>Updates</label>
            <p style={styles.hint}>The app checks for updates automatically on launch. You can also check manually.</p>
            <div style={styles.updateRow}>
              <button
                style={styles.updateBtn}
                onClick={handleCheckUpdates}
                disabled={updateState === 'checking' || updateState === 'downloading'}
              >
                {updateState === 'checking' ? 'Checking…'
                  : updateState === 'downloading' ? `Downloading ${updateInfo}`
                  : 'Check for Updates'}
              </button>
              {updateState === 'up-to-date' && (
                <span style={{ color: '#3DBA6F', fontSize: 12 }}>You're up to date</span>
              )}
              {updateState === 'available' && (
                <span style={{ color: '#E8A020', fontSize: 12 }}>v{updateInfo} available — downloading...</span>
              )}
              {updateState === 'ready' && (
                <button style={styles.installBtn} onClick={() => api.installUpdate()}>
                  Restart &amp; Install v{updateInfo}
                </button>
              )}
              {updateState === 'error' && (
                <span style={{ color: '#E84040', fontSize: 11 }}>{updateInfo || 'Update check failed'}</span>
              )}
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save & Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RoleOption({ value, selected, label, onSelect }) {
  return (
    <button
      style={{
        ...styles.roleBtn,
        borderColor: selected ? '#E8A020' : 'var(--border)',
        background: selected ? 'rgba(232,160,32,0.12)' : 'var(--bg-input)',
        color: selected ? '#E8A020' : 'var(--text-secondary)',
        fontWeight: selected ? 600 : 400,
      }}
      onClick={onSelect}
    >
      {label}
    </button>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    backdropFilter: 'blur(4px)',
  },
  panel: {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-light)',
    borderRadius: 8,
    width: 520,
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
  },
  title: {
    fontFamily: "'Barlow', sans-serif",
    fontWeight: 700,
    fontSize: 18,
    color: 'var(--text-primary)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: 16,
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 4,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 2,
  },
  hint: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
  },
  input: {
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text-primary)',
    padding: '8px 10px',
    fontSize: 12,
    outline: 'none',
    width: '100%',
  },
  roleRow: {
    display: 'flex',
    gap: 8,
    marginTop: 4,
  },
  roleBtn: {
    flex: 1,
    fontFamily: "'Barlow', sans-serif",
    fontSize: 13,
    padding: '8px 16px',
    borderRadius: 4,
    border: '1px solid',
    cursor: 'pointer',
    transition: 'all 0.1s',
    letterSpacing: '0.04em',
  },
  checkLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-primary)',
    cursor: 'pointer',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: '14px 20px',
    borderTop: '1px solid var(--border)',
  },
  cancelBtn: {
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    padding: '7px 16px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: "'Barlow', sans-serif",
  },
  saveBtn: {
    background: '#3DBA6F',
    border: 'none',
    color: '#000',
    padding: '7px 20px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 700,
    fontFamily: "'Barlow', sans-serif",
  },
  updateRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  updateBtn: {
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    padding: '7px 16px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: "'Barlow', sans-serif",
  },
  installBtn: {
    background: '#3DBA6F',
    border: 'none',
    color: '#000',
    padding: '7px 16px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "'Barlow', sans-serif",
  },
};
