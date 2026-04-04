import React from 'react';

// Compact SVG-based signal flow diagram: XR18 <-> NDI network <-> Dante
// Shows live TX/RX states with coloured lines

export default function SignalFlow({ machineRole, txStatus, rxStatus, hostname, remoteSource }) {
  const txActive = txStatus === 'running';
  const rxActive = rxStatus === 'running';
  const txWaiting = txStatus === 'waiting';
  const rxWaiting = rxStatus === 'waiting';

  const txColor = txActive ? '#E8A020' : txWaiting ? '#7A4A00' : '#2A2A2A';
  const rxColor = rxActive ? '#20B8E8' : rxWaiting ? '#005A7A' : '#2A2A2A';

  const localLabel = machineRole === 'xr18' ? 'XR18' : 'DANTE';
  const remoteLabel = machineRole === 'xr18' ? 'DANTE' : 'XR18';
  const safeName = hostname ? hostname.toUpperCase().replace(/[^A-Z0-9\-]/g, '-') : 'LOCAL';
  const remoteHostname = remoteSource
    ? remoteSource.split(/\s*\.\s*/)[0]
    : remoteLabel;

  return (
    <div style={styles.wrapper}>
      <svg width="100%" height="52" viewBox="0 0 700 52" preserveAspectRatio="xMidYMid meet">
        {/* Local device box */}
        <rect x="8" y="10" width="110" height="32" rx="3"
          fill="#161616" stroke="#2A2A2A" strokeWidth="1" />
        <text x="63" y="23" textAnchor="middle" fill="#888" fontSize="8"
          fontFamily="'DM Mono', monospace" letterSpacing="1">LOCAL</text>
        <text x="63" y="36" textAnchor="middle" fill="#ccc" fontSize="11"
          fontFamily="'Barlow', sans-serif" fontWeight="600">{localLabel}</text>

        {/* NDI cloud */}
        <rect x="290" y="8" width="120" height="36" rx="4"
          fill="#0F0F0F" stroke="#333" strokeWidth="1" />
        <text x="350" y="22" textAnchor="middle" fill="#555" fontSize="8"
          fontFamily="'DM Mono', monospace" letterSpacing="2">NETWORK</text>
        <text x="350" y="36" textAnchor="middle" fill="#666" fontSize="11"
          fontFamily="'Barlow', sans-serif" fontWeight="600">NDI</text>

        {/* Remote device box */}
        <rect x="582" y="10" width="110" height="32" rx="3"
          fill="#161616" stroke="#2A2A2A" strokeWidth="1" />
        <text x="637" y="23" textAnchor="middle" fill="#888" fontSize="8"
          fontFamily="'DM Mono', monospace" letterSpacing="1">REMOTE</text>
        <text x="637" y="36" textAnchor="middle" fill="#ccc" fontSize="11"
          fontFamily="'Barlow', sans-serif" fontWeight="600">{remoteLabel}</text>

        {/* TX arrow: local -> NDI (amber, top) */}
        <line x1="118" y1="22" x2="290" y2="22"
          stroke={txColor} strokeWidth={txActive ? 2 : 1}
          strokeDasharray={txActive ? 'none' : '4 4'} />
        <polygon points="290,22 284,19 284,25" fill={txColor} />
        {/* TX label */}
        <text x="204" y="17" textAnchor="middle" fill={txActive ? '#E8A020' : '#444'} fontSize="8"
          fontFamily="'DM Mono', monospace">TX</text>

        {/* TX continuation: NDI -> remote (amber, top) */}
        <line x1="410" y1="22" x2="582" y2="22"
          stroke={txColor} strokeWidth={txActive ? 2 : 1}
          strokeDasharray={txActive ? 'none' : '4 4'} />
        <polygon points="582,22 576,19 576,25" fill={txColor} />

        {/* RX arrow: remote -> NDI (blue, bottom) */}
        <line x1="582" y1="30" x2="410" y2="30"
          stroke={rxColor} strokeWidth={rxActive ? 2 : 1}
          strokeDasharray={rxActive ? 'none' : '4 4'} />
        <polygon points="410,30 416,27 416,33" fill={rxColor} />

        {/* RX continuation: NDI -> local (blue, bottom) */}
        <line x1="290" y1="30" x2="118" y2="30"
          stroke={rxColor} strokeWidth={rxActive ? 2 : 1}
          strokeDasharray={rxActive ? 'none' : '4 4'} />
        <polygon points="118,30 124,27 124,33" fill={rxColor} />
        {/* RX label */}
        <text x="204" y="42" textAnchor="middle" fill={rxActive ? '#20B8E8' : '#444'} fontSize="8"
          fontFamily="'DM Mono', monospace">RX</text>

        {/* Hostname labels */}
        <text x="63" y="50" textAnchor="middle" fill="#444" fontSize="8"
          fontFamily="'DM Mono', monospace">{safeName}</text>
        <text x="637" y="50" textAnchor="middle" fill="#444" fontSize="8"
          fontFamily="'DM Mono', monospace">{remoteHostname}</text>
      </svg>
    </div>
  );
}

const styles = {
  wrapper: {
    background: '#0A0A0A',
    borderBottom: '1px solid var(--border)',
    padding: '0 8px',
    flexShrink: 0,
  },
};
