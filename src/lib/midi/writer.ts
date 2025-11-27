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

  // Build a Map for O(1) noteOff lookups instead of O(n) find operations
  const noteOffMap = new Map<string, number>();
  events.forEach(event => {
    if (event.type === 'noteOff' && event.note !== undefined && event.channel !== undefined) {
      const key = `${event.channel}-${event.note}-${event.absoluteTime}`;
      noteOffMap.set(key, event.absoluteTime);
    }
  });

  // Convert events back to Tone.js format
  const processedNotes = new Set<string>();
  
  events.forEach(event => {
    const time = event.absoluteTime / ppq; // Convert ticks to beats

    switch (event.type) {
      case 'noteOn':
        if (event.note !== undefined && event.velocity !== undefined && event.channel !== undefined) {
          // Find corresponding noteOff using channel-note key
          let noteOffTime: number | undefined;
          let searchTime = event.absoluteTime + 1;
          
          // Search for the next noteOff for this channel-note combination
          while (!noteOffTime && searchTime <= event.absoluteTime + 100000) {
            const key = `${event.channel}-${event.note}-${searchTime}`;
            if (noteOffMap.has(key)) {
              noteOffTime = noteOffMap.get(key);
              break;
            }
            searchTime++;
          }
          
          // If still not found, do a fallback search in the events array
          if (!noteOffTime) {
            const noteOffEvent = events.find(
              e => e.type === 'noteOff' && 
                   e.note === event.note && 
                   e.absoluteTime > event.absoluteTime &&
                   e.channel === event.channel
            );
            noteOffTime = noteOffEvent?.absoluteTime;
          }
          
          const duration = noteOffTime 
            ? (noteOffTime - event.absoluteTime) / ppq 
            : 0.25; // Default quarter note

          const noteKey = `${event.channel}-${event.note}-${event.absoluteTime}`;
          if (!processedNotes.has(noteKey)) {
            track.addNote({
              midi: event.note,
              time,
              duration,
              velocity: event.velocity / 127,
            });
            processedNotes.add(noteKey);
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

      // Program changes are handled by @tonejs/midi via track.instrument.number
      // No need to add them as events
    }
  });

  return midi.toArray();
}

