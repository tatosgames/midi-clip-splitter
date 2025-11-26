// MIDI and SMF type definitions

export interface MIDIHeader {
  format: 0 | 1 | 2;
  trackCount: number;
  ppq: number; // Pulses Per Quarter note (ticks per beat)
}

export interface MIDIEvent {
  type: 'noteOn' | 'noteOff' | 'cc' | 'programChange' | 'pitchBend' | 'aftertouch' | 'channelAftertouch' | 'meta' | 'sysex' | 'unknown';
  deltaTime: number;
  absoluteTime: number;
  channel?: number;
  note?: number;
  velocity?: number;
  controller?: number;
  value?: number;
  program?: number;
  metaType?: string;
  data?: Uint8Array;
  text?: string;
}

export interface MIDITrack {
  index: number;
  name: string;
  events: MIDIEvent[];
  channels: Set<number>;
  noteRange: { min: number; max: number } | null;
  eventCount: number;
}

export interface ParsedMIDI {
  header: MIDIHeader;
  tracks: MIDITrack[];
  fileName: string;
  duration: number; // in ticks
}

export interface OutputTrackConfig {
  outputId: 'A' | 'B' | 'C' | 'D';
  sourceTracks: number[]; // indices of source tracks to merge
  channelFilter?: number[]; // if specified, only include these channels
  stripProgramChange: boolean;
}

export interface SplitSettings {
  stepsPerBar: number;
  maxStepsPerClip: number;
  ppq: number;
}

export interface ExportFile {
  filename: string;
  data: Uint8Array;
  trackId: 'A' | 'B' | 'C' | 'D';
  splitIndex?: number;
  stepRange: { start: number; end: number };
}

export interface ExportMetadata {
  generatedAt: string;
  sourceFile: string;
  ppq: number;
  splitSettings: SplitSettings;
  files: {
    filename: string;
    trackId: string;
    splitIndex?: number;
    stepRange: { start: number; end: number };
    sourceTracks: number[];
  }[];
}
