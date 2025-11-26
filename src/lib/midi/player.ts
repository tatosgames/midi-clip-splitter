import * as Tone from 'tone';
import Soundfont from 'soundfont-player';
import type { ParsedMIDI, MIDITrack } from './types';
import { getInstrumentName } from './gm-instruments';
import { DEFAULT_BPM } from './constants';

export interface TrackSynth {
  instrument: any; // Soundfont player instance
  part: Tone.Part | null;
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

  constructor() {
    // Initialize Tone.js with better defaults
    Tone.context.lookAhead = 0.1;
  }

  async initialize(midi: ParsedMIDI) {
    await Tone.start();
    this.dispose();
    this.parsedMidi = midi;
    this.audioContext = Tone.context.rawContext as AudioContext;

    // Read BPM from MIDI file, fallback to default
    const midiData = midi as any;
    const bpm = (midiData.header?.tempos?.[0]?.bpm) || DEFAULT_BPM;
    
    // Set Tone.js transport BPM
    Tone.Transport.bpm.value = bpm;

    // Calculate duration in seconds
    const beatsPerTick = 1 / midi.header.ppq;
    const secondsPerBeat = 60 / bpm;
    this.duration = (midi.duration * beatsPerTick * secondsPerBeat);

    // Initialize loading tracking
    this.loadingProgress = 0;
    this.totalTracksToLoad = midi.tracks.length;

    // Load instruments for each track
    await Promise.all(
      midi.tracks.map(async (track, index) => {
        await this.loadTrackInstrument(track, index, midi.header.ppq, bpm);
        this.loadingProgress++;
      })
    );

    Tone.Transport.position = 0;
    Tone.Transport.loop = false;
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
      // Use a drum kit for channel 10
      instrumentName = 'synth_drum';
    } else if (track.program !== undefined) {
      // Use the program number from the MIDI file
      instrumentName = getInstrumentName(track.program);
    } else {
      // Default to piano
      instrumentName = 'acoustic_grand_piano';
    }

    try {
      // Load instrument from CDN
      const instrument = await Soundfont.instrument(
        this.audioContext,
        instrumentName as any,
        { soundfont: 'MusyngKite' }
      );

      const events = this.convertTrackToEvents(track, ppq, bpm);
      
      const part = new Tone.Part((time, event) => {
        if (event.type === 'noteOn' && instrument) {
          // Schedule note with Tone.js timing but play with soundfont
          const now = Tone.now();
          const when = Math.max(0, time - now); // Prevent negative timing
          
          instrument.play(
            event.note,
            this.audioContext!.currentTime + when,
            {
              duration: event.duration,
              gain: event.velocity / 127,
            }
          );
        }
      }, events);

      this.tracks.set(index, {
        instrument,
        part,
        muted: false,
        solo: false,
        isLoaded: true,
      });
    } catch (error) {
      console.error(`Failed to load instrument for track ${index}:`, error);
      
      // Fallback to a simple synth if soundfont loading fails
      const fallbackSynth = new Tone.PolySynth(Tone.Synth, {
        envelope: {
          attack: 0.005,
          decay: 0.1,
          sustain: 0.3,
          release: 0.5,
        },
        volume: -6,
      }).toDestination();

      const events = this.convertTrackToEvents(track, ppq, bpm);
      
      const part = new Tone.Part((time, event) => {
        if (event.type === 'noteOn') {
          fallbackSynth.triggerAttackRelease(
            Tone.Frequency(event.note, 'midi').toNote(),
            event.duration,
            time,
            event.velocity / 127
          );
        }
      }, events);

      this.tracks.set(index, {
        instrument: fallbackSynth,
        part,
        muted: false,
        solo: false,
        isLoaded: true,
      });
    }
  }

  private convertTrackToEvents(track: MIDITrack, ppq: number, bpm: number) {
    const events: any[] = [];
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
              type: 'noteOn',
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
            type: 'noteOn',
            time: noteOn.time,
            note: event.note,
            velocity: noteOn.velocity,
            duration: timeInSeconds - noteOn.time,
          });
          noteOnMap.delete(event.note);
        }
      }
    });

    return events;
  }

  play() {
    if (!this.parsedMidi) return;
    
    // Handle solo logic
    const soloTracks = Array.from(this.tracks.entries()).filter(([_, t]) => t.solo);
    const hasSolo = soloTracks.length > 0;

    this.tracks.forEach((trackSynth) => {
      const shouldPlay = hasSolo ? trackSynth.solo : !trackSynth.muted;
      
      if (shouldPlay && trackSynth.isLoaded) {
        trackSynth.part?.start(0);
      } else {
        trackSynth.part?.stop();
      }
    });

    Tone.Transport.start();
    this.isPlaying = true;
  }

  pause() {
    Tone.Transport.pause();
    this.isPlaying = false;
  }

  stop() {
    Tone.Transport.stop();
    this.tracks.forEach(t => t.part?.stop());
    this.isPlaying = false;
  }

  seek(seconds: number) {
    Tone.Transport.seconds = Math.max(0, Math.min(seconds, this.duration));
  }

  setTrackMute(trackIndex: number, muted: boolean) {
    const track = this.tracks.get(trackIndex);
    if (track) {
      track.muted = muted;
      if (this.isPlaying) {
        this.updateTrackPlayback(trackIndex);
      }
    }
  }

  setTrackSolo(trackIndex: number, solo: boolean) {
    const track = this.tracks.get(trackIndex);
    if (track) {
      track.solo = solo;
      if (this.isPlaying) {
        this.updateAllTracksPlayback();
      }
    }
  }

  private updateTrackPlayback(trackIndex: number) {
    const trackSynth = this.tracks.get(trackIndex);
    if (!trackSynth || !trackSynth.isLoaded) return;

    const hasSolo = Array.from(this.tracks.values()).some(t => t.solo);
    const shouldPlay = hasSolo ? trackSynth.solo : !trackSynth.muted;

    if (shouldPlay) {
      if (!trackSynth.part?.state || trackSynth.part.state !== 'started') {
        trackSynth.part?.start(0);
      }
    } else {
      trackSynth.part?.stop();
    }
  }

  private updateAllTracksPlayback() {
    this.tracks.forEach((_, index) => this.updateTrackPlayback(index));
  }

  getPosition(): number {
    return Tone.Transport.seconds;
  }

  getDuration(): number {
    return this.duration;
  }

  getIsPlaying(): boolean {
    return this.isPlaying && Tone.Transport.state === 'started';
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
    Tone.Transport.stop();
    Tone.Transport.cancel();
    this.tracks.forEach(({ instrument, part }) => {
      part?.dispose();
      if (instrument && typeof instrument.stop === 'function') {
        instrument.stop();
      }
      if (instrument && typeof instrument.dispose === 'function') {
        instrument.dispose();
      }
    });
    this.tracks.clear();
    this.audioContext = null;
    this.loadingProgress = 0;
    this.totalTracksToLoad = 0;
  }
}
