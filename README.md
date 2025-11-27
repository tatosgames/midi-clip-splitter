# MIDI Splitter

A professional web-based MIDI file processor that helps musicians prepare multitrack MIDI files for hardware synths and DAWs. Upload, map, split, and export your MIDI patterns with ease.

## Features

### 🎹 MIDI File Processing
- **Drag & Drop Upload**: Simple file upload with instant parsing
- **Track Inspection**: View detailed track information including channels, note ranges, instruments, and event counts
- **Smart Track Mapping**: Assign source tracks to output destinations (A, B, C, D) with flexible merging
- **Channel Filtering**: Optionally filter specific MIDI channels per track

### 🎵 Playback Preview
- **Real-time MIDI Playback**: Preview your MIDI file before export
- **Instrument Rendering**: Realistic soundfont-based instrument playback
- **Per-track Playback**: Listen to individual tracks or all tracks together
- **Drum Channel Support**: Proper drum kit rendering for channel 10

### ⚙️ Flexible Configuration
- **Configurable Step Limits**: Set maximum steps per clip (default 128, adjustable for any hardware)
- **PPQ Control**: Adjust pulses per quarter note (default: source file PPQ)
- **Steps Per Bar**: Configure pattern length (default 16 steps)
- **Program Change Stripping**: Optionally remove program change events

### 📦 Professional Export
- **ZIP Bundle**: All files packaged in a single download
- **SMF Type 1 Format**: Industry-standard single-track MIDI files
- **Automatic Splitting**: Files exceeding step limits are split into sequential clips
- **Note Boundary Handling**: Intelligent note-off insertion at clip boundaries
- **Metadata JSON**: Complete export configuration documentation
- **Import Instructions**: Generic README with hardware/DAW import guides

## Technology Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI Framework**: Tailwind CSS + shadcn/ui components
- **MIDI Parsing**: @tonejs/midi
- **Audio Playback**: Tone.js + soundfont-player (Web Audio API)
- **File Bundling**: JSZip
- **Routing**: React Router

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd midi-splitter

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Building for Production

```bash
npm run build
```

Build output will be in the `dist/` directory.

## How to Use

1. **Upload MIDI File**: Drag and drop a Standard MIDI File (.mid) or click to browse
2. **Inspect Tracks**: Review track information including instruments, channels, and note ranges
3. **Configure Mapping**: Assign source tracks to output destinations (A, B, C, D)
4. **Adjust Settings**: Configure step limits, PPQ, and other parameters
5. **Preview Playback**: Listen to your MIDI file to verify mappings
6. **Export**: Generate a ZIP bundle with split MIDI files ready for import

## Architecture

### Core Modules

- **`src/lib/midi/parser.ts`**: SMF parsing into intermediate representation
- **`src/lib/midi/transform.ts`**: Track merging, filtering, and splitting logic
- **`src/lib/midi/writer.ts`**: Serialization back to SMF Type 1 format
- **`src/lib/midi/player.ts`**: Web Audio API-based MIDI playback with soundfonts
- **`src/lib/zip/package.ts`**: ZIP bundle creation with metadata

### Key Components

- **`UploadPanel`**: File selection and upload UI
- **`TrackInspector`**: Track metadata display and mapping interface
- **`MidiPlayer`**: Playback controls and preview
- **`SplitSettings`**: Configuration panel for step limits and PPQ
- **`SummaryPanel`**: Export summary with clip counts
- **`ExportPanel`**: ZIP generation and download

### Performance

- Client-side processing: All MIDI parsing and transformation happens in the browser
- No server dependency: Completely stateless, no data persistence
- Optimized for large files: Handles 5+ minute dense MIDI at PPQ 960
- Web Audio precision: Sub-millisecond accurate playback scheduling

## Configuration

### Default Settings
- **Steps Per Bar**: 16 steps (4/4 time signature)
- **Max Steps Per Clip**: 128 steps (configurable)
- **PPQ**: Inherited from source file (configurable)

### Supported MIDI Events
- Note On/Off
- Control Change (CC)
- Program Change
- Pitch Bend
- Key Aftertouch
- Channel Aftertouch

### Event Filtering
- System messages (SysEx, Song Position, etc.) are automatically removed
- Program Change messages can be optionally stripped
- All musical events are preserved

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Requires Web Audio API support.

## License

This project is open source and available under the MIT License.

## Credits

Made with 🤖❤️🎛️ by [LucaTronico](https://lucatronico.w.link/)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues, questions, or feature requests, please open an issue on GitHub.
