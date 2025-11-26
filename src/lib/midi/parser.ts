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

    const events: MIDIEvent[] = [];

    // Process notes
    track.notes.forEach(note => {
      channels.add(note.midi % 16); // Approximate channel from note
      noteMin = Math.min(noteMin, note.midi);
      noteMax = Math.max(noteMax, note.midi);
      hasNotes = true;

      const absoluteTime = Math.round(note.ticks);
      
      events.push({
        type: 'noteOn',
        deltaTime: 0, // Will be calculated later
        absoluteTime,
        channel: note.midi % 16,
        note: note.midi,
        velocity: Math.round(note.velocity * 127),
      });

      events.push({
        type: 'noteOff',
        deltaTime: 0,
        absoluteTime: absoluteTime + Math.round(note.durationTicks),
        channel: note.midi % 16,
        note: note.midi,
        velocity: 0,
      });
    });

    // Process control changes
    Object.entries(track.controlChanges).forEach(([controller, ccList]) => {
      ccList.forEach(cc => {
        events.push({
          type: 'cc',
          deltaTime: 0,
          absoluteTime: Math.round(cc.ticks),
          channel: 0, // Default channel
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
