// Audio device enumeration via naudiodon (optional native module)
// Falls back gracefully if not installed or not on Windows

let naudiodon = null;
try {
  naudiodon = require('naudiodon');
} catch {
  // naudiodon not available — will return empty list
}

const XR18_CHANNEL_PAIRS = [
  'Ch 1-2', 'Ch 3-4', 'Ch 5-6', 'Ch 7-8',
  'Ch 9-10', 'Ch 11-12', 'Ch 13-14', 'Ch 15-16',
  'Ch 17-18', 'Aux 1-2', 'Aux 3-4', 'Aux 5-6',
  'Bus 1-2', 'Bus 3-4', 'Bus 5-6', 'Main L/R',
];

function getSystemDevices() {
  if (!naudiodon) return [];
  try {
    return naudiodon.getDevices().map(d => ({
      id: d.id,
      name: d.name,
      maxInputChannels: d.maxInputChannels,
      maxOutputChannels: d.maxOutputChannels,
      hostAPIName: d.hostAPIName || '',
      isDefaultInput: d.isDefaultInput || false,
      isDefaultOutput: d.isDefaultOutput || false,
    }));
  } catch (err) {
    console.error('audioDevices: failed to enumerate:', err.message);
    return [];
  }
}

function getXr18ChannelPairs(deviceName) {
  // Returns the canonical channel pair list for the XR18
  return XR18_CHANNEL_PAIRS.map(pair => ({
    label: pair,
    deviceString: `WASAPI: ${deviceName || 'Behringer XR18'} (${pair})`,
  }));
}

function getDanteChannelPairs(devices) {
  // Filter for Dante Virtual Soundcard devices and return channel pairs
  const danteDevices = devices.filter(d =>
    d.name.toLowerCase().includes('dante') ||
    d.name.toLowerCase().includes('dvs')
  );

  if (danteDevices.length === 0) {
    // Return generic stereo pairs up to 32ch
    return Array.from({ length: 16 }, (_, i) => ({
      label: `Ch ${i * 2 + 1}-${i * 2 + 2}`,
      deviceString: `ASIO: Dante Virtual Soundcard (Ch ${i * 2 + 1}-${i * 2 + 2})`,
    }));
  }

  const pairs = [];
  danteDevices.forEach(dev => {
    const maxCh = Math.max(dev.maxInputChannels, dev.maxOutputChannels);
    const numPairs = Math.floor(Math.min(maxCh, 64) / 2);
    for (let i = 0; i < numPairs; i++) {
      const prefix = dev.hostAPIName.toLowerCase().includes('asio') ? 'ASIO' : 'WASAPI';
      pairs.push({
        label: `Ch ${i * 2 + 1}-${i * 2 + 2}`,
        deviceString: `${prefix}: ${dev.name} (Ch ${i * 2 + 1}-${i * 2 + 2})`,
      });
    }
  });
  return pairs;
}

function getAudioDevices(machineRole) {
  const systemDevices = getSystemDevices();

  if (machineRole === 'xr18') {
    // Find XR18 device by name
    const xr18 = systemDevices.find(d =>
      d.name.toLowerCase().includes('xr18') ||
      d.name.toLowerCase().includes('behringer')
    );
    return {
      systemDevices,
      channelPairs: getXr18ChannelPairs(xr18 ? xr18.name : null),
      detectedDevice: xr18 ? xr18.name : null,
    };
  } else if (machineRole === 'dante') {
    return {
      systemDevices,
      channelPairs: getDanteChannelPairs(systemDevices),
      detectedDevice: systemDevices.find(d =>
        d.name.toLowerCase().includes('dante') ||
        d.name.toLowerCase().includes('dvs')
      )?.name || null,
    };
  }

  return { systemDevices, channelPairs: [], detectedDevice: null };
}

module.exports = { getAudioDevices, XR18_CHANNEL_PAIRS };
