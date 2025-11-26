import { Midi } from '@tonejs/midi';
import type { MIDIEvent, MIDIHeader } from './types';

export function writeMIDIFile(
  events: MIDIEvent[],
  ppq: number,
  trackName: string
): Uint8Array {
  const midi = new Midi();
  midi.header.setTempo(120); // Set default tempo
  
  const track = midi.addTrack();
  track.name = trackName;

  // Convert events back to Tone.js format
  events.forEach(event => {
    const time = event.absoluteTime / ppq; // Convert ticks to beats

    switch (event.type) {
      case 'noteOn':
        if (event.note !== undefined && event.velocity !== undefined) {
          // Find corresponding noteOff
          const noteOffEvent = events.find(
            e => e.type === 'noteOff' && 
                 e.note === event.note && 
                 e.absoluteTime > event.absoluteTime &&
                 e.channel === event.channel
          );
          
          const duration = noteOffEvent 
            ? (noteOffEvent.absoluteTime - event.absoluteTime) / ppq 
            : 0.25; // Default quarter note

          track.addNote({
            midi: event.note,
            time,
            duration,
            velocity: event.velocity / 127,
          });
        }
        break;

      case 'cc':
        if (event.controller !== undefined && event.value !== undefined) {
          track.addCC({
            number: event.controller,
            value: event.value / 127,
            time,
          });
        }
        break;

      case 'programChange':
        if (event.program !== undefined) {
          track.addPitchBend({
            value: event.program,
            time,
          });
        }
        break;
    }
  });

  return midi.toArray();
}

export function variableLengthQuantity(value: number): number[] {
  const bytes: number[] = [];
  let buffer = value & 0x7f;

  while (value >>= 7) {
    buffer <<= 8;
    buffer |= ((value & 0x7f) | 0x80);
  }

  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) {
      buffer >>= 8;
    } else {
      break;
    }
  }

  return bytes;
}
