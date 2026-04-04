# NDI Comms Router — Claude Code Project Spec

## Core Concept

Build a cross-platform Electron application that acts as a GUI wrapper for the `ndi-free-audio` CLI tool, routing full-duplex comms audio between a Behringer XR18 and Dante Virtual Soundcard across a network using NDI.

Two computers on the same network. Each runs this app. At launch the operator selects which machine they are:
- **XR18 PC** — has the Behringer XR18 connected via USB (appears as a multi-channel WASAPI device)
- **Dante PC** — has Dante Virtual Soundcard installed (appears as ASIO/WASAPI device)

Each machine runs two `ndi-free-audio` child processes simultaneously:
- **TX leg** — reads from local hardware audio device, publishes as NDI stream to network
- **RX leg** — subscribes to remote NDI stream from the other machine, plays out to local hardware audio device

---

## Technology Stack

- Electron (Node.js backend + Chromium frontend)
- React for UI
- NDI SDK bindings or `ndi-free-audio --list` polling for source discovery
- `child_process.spawn` to launch and manage `ndi-free-audio` processes
- `naudiodon` or equivalent for enumerating local WASAPI/ASIO audio devices and channels

---

## Build Stages (work through these in order)

### Stage 1 — Scaffold
- Electron + React project structure
- Main/renderer process separation
- IPC bridge setup
- Folder structure as defined below

### Stage 2 — Machine Selector
- Full-screen launch screen: "Which machine is this?"
- Two options: XR18 PC / Dante PC
- Persist choice in `app.getPath('userData')/config.json`
- Changeable from settings

### Stage 3 — Audio Device Enumeration
- Enumerate all WASAPI/ASIO devices on the local machine at startup
- XR18 PC: expose XR18 channel pairs as a selectable grid:
  Ch 1-2, Ch 3-4, Ch 5-6, Ch 7-8, Ch 9-10, Ch 11-12, Ch 13-14, Ch 15-16, Ch 17-18, Aux 1-2, Aux 3-4, Aux 5-6, Bus 1-2, Bus 3-4, Bus 5-6, Main L/R
- Dante PC: enumerate Dante Virtual Soundcard ASIO/WASAPI channels similarly
- Present as a visual channel grid, not a flat dropdown

### Stage 4 — NDI Source Discovery
- Continuously poll for NDI sources using `ndi-free-audio --list` on an interval
- Display sources with originating hostname
- Three source states:
  - **Scanning** — pulsing amber, not yet found
  - **Available** — found on network, ready
  - **Connected** — actively receiving
- RX leg: if source not yet available when started, hold in "Waiting for source..." and auto-connect when it appears
- Auto-reconnect if source drops and reappears

### Stage 5 — Process Manager
- `processManager.js` — spawn/kill `ndi-free-audio` instances via `child_process.spawn`
- Configurable binary path stored in config.json
- Capture stdout/stderr from each process
- Clean kill on app quit (handle SIGTERM)
- TX leg starts immediately regardless of remote state
- RX leg starts in waiting state if remote source not visible, auto-connects when found

### Stage 6 — TX / RX Leg Panels
Each leg exposes:
- Local hardware device selector (channel grid)
- Remote NDI source selector (RX) or NDI stream name display (TX)
- Gain control: -20 to +20 dB slider
- Buffer latency picker: 4, 8, 12, 16, 24, 32, 48, 64 ms
- Mute toggle (silences without killing process)
- Start / Stop button
- Live L/R VU meters parsed from stdout
- Real-time CLI command preview

### Stage 7 — Master Controls
- Start Full-Duplex button (launches both legs)
- Stop All button (kills both processes cleanly)
- Link TX/RX latency toggle

### Stage 8 — Console Log Panel
- Timestamped entries tagged: SYS / TX / RX
- Colour coded: TX amber, RX blue, SYS grey, errors red, success green
- Auto-scroll to latest
- 120+ lines, scrollable

### Stage 9 — Settings Panel
- Path to `ndi-free-audio` binary
- Machine role selector
- Auto-start on launch toggle
- Network interface selector (for multi-NIC machines)

### Stage 10 — Polish
- Signal flow diagram at top showing live state of both legs
- App icon
- Windows installer via electron-builder

---

## Per-Leg CLI Command Format

    # TX
    ndi-free-audio --tx -s "XR18-PC . Comms TX" -d "WASAPI: Behringer XR18 (Ch 1-2)" -g 0 -b 12

    # RX
    ndi-free-audio --rx -s "DANTE-PC . Comms TX" -d "WASAPI: Behringer XR18 (Ch 1-2)" -g 0 -b 12

NDI stream names follow the format: [HOSTNAME] . Comms TX

---

## Folder Structure

    ndi-comms-router/
    src/
      main/
        index.js              - app init, IPC handlers
        audioDevices.js       - enumerate WASAPI/ASIO devices
        ndiScanner.js         - NDI source discovery (poll ndi-free-audio --list)
        processManager.js     - spawn/kill ndi-free-audio instances
        configManager.js      - read/write config.json
      renderer/
        App.jsx
        components/
          MachineSelector.jsx
          LegPanel.jsx
          ChannelGrid.jsx
          VUMeter.jsx
          SourceStatus.jsx
          ConsoleLog.jsx
          Settings.jsx
      assets/
        icon.png
    package.json
    CLAUDE.md

---

## Visual Design

- Dark broadcast-grade aesthetic
- Two-column layout: TX left, RX right
- TX accent colour: amber (#E8A020)
- RX accent colour: blue (#20B8E8)
- Fonts: DM Mono for data/labels, Barlow for headings
- Signal flow diagram at top showing XR18 <-> NDI <-> Dante with live state
- No purple gradients or default system UI styling

---

## Platform

- Windows primary (XR18 WASAPI + Dante VS ASIO are Windows-first)
- macOS support optional
- Linux not required

---

## Config File Schema (config.json)

    {
      "machineRole": "xr18",
      "binaryPath": "C:/Program Files/NDI Free Audio/ndi-free-audio.exe",
      "autoStart": false,
      "networkInterface": "auto",
      "tx": {
        "device": "WASAPI: Behringer XR18 (Ch 1-2)",
        "gain": 0,
        "latency": 12
      },
      "rx": {
        "source": "DANTE-PC . Comms TX",
        "device": "WASAPI: Behringer XR18 (Ch 1-2)",
        "gain": 0,
        "latency": 12
      }
    }

---

## Notes

- `ndi-free-audio` binary path must be configurable — do not hardcode
- Both legs should survive the other machine restarting without requiring app restart
- VU meters should degrade gracefully if stdout parsing fails — show flat meters, do not crash
- All IPC between main and renderer via contextBridge (no nodeIntegration)
