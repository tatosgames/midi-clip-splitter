import { Midi } from '@tonejs/midi';
import type { MIDIHeader, MIDITrack, ParsedMIDI, MIDIEvent } from './types';
import { DRUM_CHANNEL, TIME_SIGNATURE_NUMERATOR } from './constants';

export async function parseMIDIFile(file: File): Promise<ParsedMIDI> {
  const arrayBuffer = await file.arrayBuffer();
  const midi = new Midi(arrayBuffer);
  
  const header: MIDIHeader = {
    format: midi.tracks.length === 1 ? 0 : 1,
    trackCount: midi.tracks.length,
    ppq: midi.header.ppq,
  };

  const tracks: MIDITrack[] = midi.tracks.map((track, index) => {
    const channels = new Set<number>();
    let noteMin = 127;
    let noteMax = 0;
    let hasNotes = false;
    let program: number | undefined;
    let isDrums = false;

    const events: MIDIEvent[] = [];

    // Process notes and detect channels
    track.notes.forEach(note => {
      // Use channel from track if available, otherwise default to 0
      const channel = track.channel !== undefined ? track.channel : 0;
      channels.add(channel);
      noteMin = Math.min(noteMin, note.midi);
      noteMax = Math.max(noteMax, note.midi);
      hasNotes = true;

      const absoluteTime = Math.round(note.ticks);
      
      events.push({
        type: 'noteOn',
        deltaTime: 0, // Will be calculated later
        absoluteTime,
        channel,
        note: note.midi,
        velocity: Math.round(note.velocity * 127),
      });

      events.push({
        type: 'noteOff',
        deltaTime: 0,
        absoluteTime: absoluteTime + Math.round(note.durationTicks),
        channel,
        note: note.midi,
        velocity: 0,
      });
    });

    // Check if track uses drum channel (channel 10 = index 9) or instrument is percussion
    if (track.channel === DRUM_CHANNEL || track.instrument?.percussion) {
      isDrums = true;
    } else {
      // Also check track name as fallback
      const trackNameLower = (track.name || '').toLowerCase();
      if (trackNameLower.includes('drum') || trackNameLower.includes('perc')) {
        isDrums = true;
      }
    }

    // Detect program change (instrument selection)
    if (track.instrument) {
      program = track.instrument.number;
    }

    // Process control changes
    Object.entries(track.controlChanges).forEach(([controller, ccList]) => {
      ccList.forEach(cc => {
        const channel = track.channel !== undefined ? track.channel : 0;
        events.push({
          type: 'cc',
          deltaTime: 0,
          absoluteTime: Math.round(cc.ticks),
          channel,
          controller: parseInt(controller),
          value: Math.round(cc.value * 127),
        });
      });
    });

    // Sort by absolute time
    events.sort((a, b) => a.absoluteTime - b.absoluteTime);

    // Calculate delta times
    let lastTime = 0;
    events.forEach(event => {
      event.deltaTime = event.absoluteTime - lastTime;
      lastTime = event.absoluteTime;
    });

    return {
      index,
      name: track.name || `Track ${index + 1}`,
      events,
      channels,
      noteRange: hasNotes ? { min: noteMin, max: noteMax } : null,
      eventCount: events.length,
      program,
      isDrums,
    };
  });

  const duration = Math.max(...tracks.map(t => 
    t.events.length > 0 ? t.events[t.events.length - 1].absoluteTime : 0
  ));

  // Read tempo from MIDI file (use first tempo event)
  const tempo = midi.header.tempos && midi.header.tempos.length > 0 
    ? midi.header.tempos[0].bpm 
    : undefined;

  return {
    header,
    tracks,
    fileName: file.name,
    duration,
    tempo,
  };
}

export function calculateSteps(ticks: number, ppq: number, stepsPerBar: number): number {
  const ticksPerStep = (ppq * TIME_SIGNATURE_NUMERATOR) / stepsPerBar;
  return Math.ceil(ticks / ticksPerStep);
}

export function ticksToSteps(ticks: number, ppq: number, stepsPerBar: number): number {
  const ticksPerStep = (ppq * TIME_SIGNATURE_NUMERATOR) / stepsPerBar;
  return Math.floor(ticks / ticksPerStep);
}

export function stepsToTicks(steps: number, ppq: number, stepsPerBar: number): number {
  const ticksPerStep = (ppq * TIME_SIGNATURE_NUMERATOR) / stepsPerBar;
  return steps * ticksPerStep;
}
