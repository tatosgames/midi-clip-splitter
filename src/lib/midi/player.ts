import * as Tone from 'tone';
import Soundfont from 'soundfont-player';
import type { ParsedMIDI, MIDITrack } from './types';
import { getInstrumentName } from './gm-instruments';
import { DEFAULT_BPM } from './constants';

// Structure for scheduled events
interface ScheduledEvent {
  time: number; // in seconds
  note: number;
  velocity: number;
  duration: number;
}

export interface TrackSynth {
  instrument: any; // Soundfont player instance
  events: ScheduledEvent[]; // Pre-calculated events
  nextEventIndex: number; // Current position in events array
  muted: boolean;
  solo: boolean;
  isLoaded: boolean;
}

export class MidiPlayer {
  private tracks: Map<number, TrackSynth> = new Map();
  private parsedMidi: ParsedMIDI | null = null;
  private isPlaying = false;
  private duration = 0;
  private audioContext: AudioContext | null = null;
  private loadingProgress = 0;
  private totalTracksToLoad = 0;
  
  // Scheduler properties
  private scheduleAheadTime = 0.1; // seconds to schedule ahead
  private schedulerInterval: number | null = null;
  private startTime = 0; // when playback started
  private pauseOffset = 0; // position when paused

  // Instrument cache to avoid re-downloading
  private static instrumentCache: Map<string, any> = new Map();

  constructor() {
    // Context will be initialized in initialize()
  }

  async initialize(midi: ParsedMIDI) {
    await Tone.start();
    this.dispose();
    this.parsedMidi = midi;
    this.audioContext = Tone.context.rawContext as AudioContext;

    // Read BPM from MIDI file
    const bpm = midi.tempo || DEFAULT_BPM;

    // Calculate duration in seconds
    const beatsPerTick = 1 / midi.header.ppq;
    const secondsPerBeat = 60 / bpm;
    this.duration = (midi.duration * beatsPerTick * secondsPerBeat);

    // Initialize loading tracking
    this.loadingProgress = 0;
    this.totalTracksToLoad = midi.tracks.length;
    this.pauseOffset = 0;

    // Load instruments for each track
    await Promise.all(
      midi.tracks.map(async (track, index) => {
        await this.loadTrackInstrument(track, index, midi.header.ppq, bpm);
        this.loadingProgress++;
      })
    );
  }

  private async loadTrackInstrument(
    track: MIDITrack,
    index: number,
    ppq: number,
    bpm: number
  ) {
    if (!this.audioContext) return;

    // Determine which instrument to load
    let instrumentName: string;
    
    if (track.isDrums) {
      instrumentName = 'synth_drum';
    } else if (track.program !== undefined) {
      instrumentName = getInstrumentName(track.program);
    } else {
      instrumentName = 'acoustic_grand_piano';
    }

    try {
      // Check cache first
      let instrument = MidiPlayer.instrumentCache.get(instrumentName);
      
      if (!instrument) {
        instrument = await Soundfont.instrument(
          this.audioContext,
          instrumentName as any,
          { soundfont: 'MusyngKite' }
        );
        MidiPlayer.instrumentCache.set(instrumentName, instrument);
      }

      const events = this.convertTrackToEvents(track, ppq, bpm);

      this.tracks.set(index, {
        instrument,
        events,
        nextEventIndex: 0,
        muted: false,
        solo: false,
        isLoaded: true,
      });
    } catch (error) {
      console.error(`Failed to load instrument for track ${index}:`, error);
      
      // Fallback: create empty track
      this.tracks.set(index, {
        instrument: null,
        events: [],
        nextEventIndex: 0,
        muted: false,
        solo: false,
        isLoaded: false,
      });
    }
  }

  private convertTrackToEvents(track: MIDITrack, ppq: number, bpm: number): ScheduledEvent[] {
    const events: ScheduledEvent[] = [];
    const noteOnMap = new Map<number, { time: number; velocity: number }>();
    const beatsPerTick = 1 / ppq;
    const secondsPerBeat = 60 / bpm;

    track.events.forEach(event => {
      const timeInSeconds = event.absoluteTime * beatsPerTick * secondsPerBeat;

      if (event.type === 'noteOn' && event.note !== undefined && event.velocity !== undefined) {
        if (event.velocity > 0) {
          noteOnMap.set(event.note, { time: timeInSeconds, velocity: event.velocity });
        } else {
          // Velocity 0 = note off
          const noteOn = noteOnMap.get(event.note);
          if (noteOn) {
            events.push({
              time: noteOn.time,
              note: event.note,
              velocity: noteOn.velocity,
              duration: timeInSeconds - noteOn.time,
            });
            noteOnMap.delete(event.note);
          }
        }
      } else if (event.type === 'noteOff' && event.note !== undefined) {
        const noteOn = noteOnMap.get(event.note);
        if (noteOn) {
          events.push({
            time: noteOn.time,
            note: event.note,
            velocity: noteOn.velocity,
            duration: timeInSeconds - noteOn.time,
          });
          noteOnMap.delete(event.note);
        }
      }
    });

    // Sort by time
    events.sort((a, b) => a.time - b.time);
    return events;
  }

  private scheduler() {
    if (!this.isPlaying || !this.audioContext) return;

    const currentTime = this.audioContext.currentTime;
    const currentPosition = currentTime - this.startTime;
    const scheduleUntil = currentPosition + this.scheduleAheadTime;

    // Handle solo logic
    const hasSolo = Array.from(this.tracks.values()).some(t => t.solo);

    this.tracks.forEach((trackSynth) => {
      const shouldPlay = hasSolo ? trackSynth.solo : !trackSynth.muted;
      if (!shouldPlay || !trackSynth.isLoaded || !trackSynth.instrument) return;

      // Schedule events for this track
      while (
        trackSynth.nextEventIndex < trackSynth.events.length &&
        trackSynth.events[trackSynth.nextEventIndex].time < scheduleUntil
      ) {
        const event = trackSynth.events[trackSynth.nextEventIndex];
        const when = this.startTime + event.time;

        // Schedule the note with Web Audio API timing
        trackSynth.instrument.play(
          event.note,
          when,
          {
            duration: event.duration,
            gain: event.velocity / 127,
          }
        );

        trackSynth.nextEventIndex++;
      }
    });

    // Check if we've reached the end
    if (currentPosition >= this.duration) {
      this.stop();
      return;
    }

    // Continue scheduling
    this.schedulerInterval = window.setTimeout(() => this.scheduler(), 25);
  }

  play() {
    if (!this.parsedMidi || !this.audioContext) return;

    this.startTime = this.audioContext.currentTime - this.pauseOffset;
    this.isPlaying = true;
    this.scheduler();
  }

  pause() {
    if (!this.audioContext) return;
    
    this.pauseOffset = this.audioContext.currentTime - this.startTime;
    this.isPlaying = false;
    
    if (this.schedulerInterval !== null) {
      clearTimeout(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  stop() {
    this.pauseOffset = 0;
    this.isPlaying = false;

    if (this.schedulerInterval !== null) {
      clearTimeout(this.schedulerInterval);
      this.schedulerInterval = null;
    }

    // Reset event indices
    this.tracks.forEach(track => {
      track.nextEventIndex = 0;
    });
  }

  seek(seconds: number) {
    const wasPlaying = this.isPlaying;
    
    if (wasPlaying) {
      this.pause();
    }

    this.pauseOffset = Math.max(0, Math.min(seconds, this.duration));

    // Reset event indices to match the new position using binary search
    this.tracks.forEach(track => {
      track.nextEventIndex = this.findEventIndexAtTime(track.events, this.pauseOffset);
    });

    if (wasPlaying) {
      this.play();
    }
  }

  private findEventIndexAtTime(events: ScheduledEvent[], targetTime: number): number {
    if (events.length === 0) return 0;
    
    let low = 0;
    let high = events.length - 1;
    
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (events[mid].time < targetTime) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    
    return low;
  }

  setTrackMute(trackIndex: number, muted: boolean) {
    const track = this.tracks.get(trackIndex);
    if (track) {
      track.muted = muted;
    }
  }

  setTrackSolo(trackIndex: number, solo: boolean) {
    const track = this.tracks.get(trackIndex);
    if (track) {
      track.solo = solo;
    }
  }

  getPosition(): number {
    if (!this.audioContext) return 0;
    
    if (this.isPlaying) {
      return this.audioContext.currentTime - this.startTime;
    }
    return this.pauseOffset;
  }

  getDuration(): number {
    return this.duration;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  getLoadingProgress(): number {
    return this.totalTracksToLoad > 0 
      ? (this.loadingProgress / this.totalTracksToLoad) * 100 
      : 0;
  }

  isLoadingComplete(): boolean {
    return this.loadingProgress === this.totalTracksToLoad && this.totalTracksToLoad > 0;
  }

  dispose() {
    this.stop();
    
    if (this.schedulerInterval !== null) {
      clearTimeout(this.schedulerInterval);
      this.schedulerInterval = null;
    }

    this.tracks.forEach(({ instrument }) => {
      if (instrument && typeof instrument.stop === 'function') {
        instrument.stop();
      }
    });
    
    this.tracks.clear();
    this.audioContext = null;
    this.loadingProgress = 0;
    this.totalTracksToLoad = 0;
    this.pauseOffset = 0;
  }
}
