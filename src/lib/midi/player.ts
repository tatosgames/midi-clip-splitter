import * as Tone from 'tone';
import type { ParsedMIDI, MIDITrack } from './types';

export interface TrackSynth {
  synth: Tone.PolySynth;
  part: Tone.Part | null;
  muted: boolean;
  solo: boolean;
}

export class MidiPlayer {
  private tracks: Map<number, TrackSynth> = new Map();
  private parsedMidi: ParsedMIDI | null = null;
  private isPlaying = false;
  private duration = 0;

  constructor() {
    // Initialize Tone.js with better defaults
    Tone.context.lookAhead = 0.1;
  }

  async initialize(midi: ParsedMIDI) {
    await Tone.start();
    this.dispose();
    this.parsedMidi = midi;

    // Calculate duration in seconds
    const bpm = 120; // Default tempo
    const beatsPerTick = 1 / midi.header.ppq;
    const secondsPerBeat = 60 / bpm;
    this.duration = (midi.duration * beatsPerTick * secondsPerBeat);

    // Create a synth for each track
    midi.tracks.forEach((track, index) => {
      const synth = new Tone.PolySynth(Tone.Synth, {
        envelope: {
          attack: 0.005,
          decay: 0.1,
          sustain: 0.3,
          release: 0.5,
        },
        volume: -6,
      }).toDestination();

      const events = this.convertTrackToEvents(track, midi.header.ppq, bpm);
      
      const part = new Tone.Part((time, event) => {
        if (event.type === 'noteOn') {
          synth.triggerAttackRelease(
            Tone.Frequency(event.note, 'midi').toNote(),
            event.duration,
            time,
            event.velocity / 127
          );
        }
      }, events);

      this.tracks.set(index, {
        synth,
        part,
        muted: false,
        solo: false,
      });
    });

    Tone.Transport.position = 0;
    Tone.Transport.loop = false;
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

    this.tracks.forEach((trackSynth, index) => {
      const shouldPlay = hasSolo ? trackSynth.solo : !trackSynth.muted;
      
      if (shouldPlay) {
        trackSynth.part?.start(0);
        trackSynth.synth.volume.value = -6;
      } else {
        trackSynth.part?.stop();
        trackSynth.synth.volume.value = -Infinity;
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
    if (!trackSynth) return;

    const hasSolo = Array.from(this.tracks.values()).some(t => t.solo);
    const shouldPlay = hasSolo ? trackSynth.solo : !trackSynth.muted;

    if (shouldPlay) {
      trackSynth.synth.volume.value = -6;
    } else {
      trackSynth.synth.volume.value = -Infinity;
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

  dispose() {
    this.stop();
    this.tracks.forEach(({ synth, part }) => {
      part?.dispose();
      synth.dispose();
    });
    this.tracks.clear();
  }
}
