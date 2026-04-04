// Audio device enumeration by running the NDI FreeAudio binary with no args
// and parsing its "Input Devices:" / "Output Devices:" sections.
// Falls back to an empty list if the binary isn't set or fails.

const { spawnSync } = require('child_process');

function parseDeviceList(output) {
  const inputDevices = [];
  const outputDevices = [];
  let section = null;

  for (const rawLine of output.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^Input Devices:/i.test(line))  { section = 'input';  continue; }
    if (/^Output Devices:/i.test(line)) { section = 'output'; continue; }
    if (/^Options:/i.test(line) || line.startsWith('-'))  { section = null; continue; }

    if (!section) continue;

    // Lines like: "1 : Dante Virtual Soundcard (x64) [default]"
    //         or: "1 : Realtek ASIO"
    const m = line.match(/^(\d+)\s*:\s*(.+?)(?:\s*\[default\])?$/i);
    if (m) {
      const name = m[2].trim().replace(/\s*\[default\]$/, '');
      if (section === 'input')  inputDevices.push(name);
      if (section === 'output') outputDevices.push(name);
    }
  }

  return { inputDevices, outputDevices };
}

function enumerateDevices(binaryPath) {
  if (!binaryPath) return { inputDevices: [], outputDevices: [] };

  try {
    const result = spawnSync(binaryPath, [], {
      timeout: 5000,
      windowsHide: true,
      encoding: 'utf8',
    });
    const combined = (result.stdout || '') + (result.stderr || '');
    return parseDeviceList(combined);
  } catch {
    return { inputDevices: [], outputDevices: [] };
  }
}

function getAudioDevices(machineRole, binaryPath) {
  const { inputDevices, outputDevices } = enumerateDevices(binaryPath);

  // All devices usable for TX input or RX output — combine unique names
  const allDevices = [...new Set([...inputDevices, ...outputDevices])];

  // Build channel pair list — for NDI FreeAudio, the "device" is just the
  // device name directly (e.g. "Dante Virtual Soundcard (x64)").
  // We present them as selectable items with the device name as both label and value.
  const channelPairs = allDevices.map(name => ({
    label: name,
    deviceString: name,
  }));

  return {
    inputDevices,
    outputDevices,
    channelPairs,
    allDevices,
  };
}

module.exports = { getAudioDevices };
