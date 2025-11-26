import { Midi } from '@tonejs/midi';
import type { MIDIHeader, MIDITrack, ParsedMIDI, MIDIEvent } from './types';

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
      // @tonejs/midi uses 'name' which includes channel info, but we'll default to 0
      const channel = 0; // Default channel, tracks in tonejs/midi don't expose channel directly
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

    // Check if track name suggests drums
    const trackNameLower = (track.name || '').toLowerCase();
    if (trackNameLower.includes('drum') || trackNameLower.includes('perc')) {
      isDrums = true;
    }

    // Detect program change (instrument selection)
    if (track.instrument) {
      program = track.instrument.number;
    }

    // Process control changes
    Object.entries(track.controlChanges).forEach(([controller, ccList]) => {
      ccList.forEach(cc => {
        const channel = 0; // Default channel
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

  return {
    header,
    tracks,
    fileName: file.name,
    duration,
  };
}

export function calculateSteps(ticks: number, ppq: number, stepsPerBar: number): number {
  const ticksPerStep = (ppq * 4) / stepsPerBar; // Assuming 4/4 time
  return Math.ceil(ticks / ticksPerStep);
}

export function ticksToSteps(ticks: number, ppq: number, stepsPerBar: number): number {
  const ticksPerStep = (ppq * 4) / stepsPerBar;
  return Math.floor(ticks / ticksPerStep);
}

export function stepsToTicks(steps: number, ppq: number, stepsPerBar: number): number {
  const ticksPerStep = (ppq * 4) / stepsPerBar;
  return steps * ticksPerStep;
}
