import { Midi } from '@tonejs/midi';
import type { MIDIEvent, MIDIHeader } from './types';

export function writeMIDIFile(
  events: MIDIEvent[],
  ppq: number,
  trackName: string,
  tempo = 120
): Uint8Array {
  const midi = new Midi();
  midi.header.setTempo(tempo);
  
  const track = midi.addTrack();
  track.name = trackName;

  // Build proper Map: key = "channel-note" → sorted array of noteOff times for efficient lookup
  const noteOffsByKey = new Map<string, number[]>();
  events.forEach(event => {
    if (event.type === 'noteOff' && event.note !== undefined && event.channel !== undefined) {
      const key = `${event.channel}-${event.note}`;
      if (!noteOffsByKey.has(key)) {
        noteOffsByKey.set(key, []);
      }
      noteOffsByKey.get(key)!.push(event.absoluteTime);
    }
  });
  
  // Sort each array for binary search
  noteOffsByKey.forEach(times => times.sort((a, b) => a - b));

  // Binary search helper to find first noteOff time > noteOn time
  const findNextNoteOff = (times: number[], noteOnTime: number): number | undefined => {
    let left = 0;
    let right = times.length - 1;
    let result: number | undefined;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (times[mid] > noteOnTime) {
        result = times[mid];
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }
    return result;
  };

  // Convert events back to Tone.js format
  const processedNotes = new Set<string>();
  
  events.forEach(event => {
    const time = event.absoluteTime / ppq; // Convert ticks to beats

    switch (event.type) {
      case 'noteOn':
        if (event.note !== undefined && event.velocity !== undefined && event.channel !== undefined) {
          // Find corresponding noteOff using optimized Map + binary search
          const noteKey = `${event.channel}-${event.note}`;
          const noteOffTimes = noteOffsByKey.get(noteKey);
          const noteOffTime = noteOffTimes ? findNextNoteOff(noteOffTimes, event.absoluteTime) : undefined;
          
          const duration = noteOffTime 
            ? (noteOffTime - event.absoluteTime) / ppq 
            : 0.25; // Default quarter note

          const uniqueKey = `${event.channel}-${event.note}-${event.absoluteTime}`;
          if (!processedNotes.has(uniqueKey)) {
            track.addNote({
              midi: event.note,
              time,
              duration,
              velocity: event.velocity / 127,
            });
            processedNotes.add(uniqueKey);
          }
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
          track.instrument.number = event.program;
        }
        break;

      case 'pitchBend':
        if (event.value !== undefined) {
          track.addPitchBend({
            value: (event.value / 8192) - 1, // Convert 0-16384 to -1 to 1
            time,
          });
        }
        break;
    }
  });

  return midi.toArray();
}

