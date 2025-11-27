import type { MIDITrack, MIDIEvent, OutputTrackConfig } from './types';
import { TIME_SIGNATURE_NUMERATOR } from './constants';

export function mergeTracks(
  tracks: MIDITrack[],
  config: OutputTrackConfig
): MIDIEvent[] {
  const mergedEvents: MIDIEvent[] = [];

  config.sourceTracks.forEach(trackIndex => {
    const track = tracks[trackIndex];
    if (!track) return;

    track.events.forEach(event => {
      // Apply channel filter if specified
      if (config.channelFilter && config.channelFilter.length > 0) {
        if (event.channel === undefined || !config.channelFilter.includes(event.channel)) {
          return;
        }
      }

      // Strip program changes if requested
      if (config.stripProgramChange && event.type === 'programChange') {
        return;
      }

      // Filter out unsupported events
      if (event.type === 'sysex' || event.type === 'unknown') {
        return;
      }

      mergedEvents.push({ ...event });
    });
  });

  // Sort by absolute time
  mergedEvents.sort((a, b) => a.absoluteTime - b.absoluteTime);

  // Recalculate delta times
  let lastTime = 0;
  mergedEvents.forEach(event => {
    event.deltaTime = event.absoluteTime - lastTime;
    lastTime = event.absoluteTime;
  });

  return mergedEvents;
}

export function splitEventsBySteps(
  events: MIDIEvent[],
  maxSteps: number,
  ppq: number,
  stepsPerBar: number
): MIDIEvent[][] {
  if (events.length === 0) return [[]];

  const ticksPerStep = (ppq * TIME_SIGNATURE_NUMERATOR) / stepsPerBar;
  const maxTicks = maxSteps * ticksPerStep;

  // Calculate total duration
  const lastEvent = events[events.length - 1];
  const totalTicks = lastEvent.absoluteTime;
  
  if (totalTicks <= maxTicks) {
    return [events];
  }

  // Build a complete map of active notes at any point in time
  const noteLifecycles = new Map<string, { noteOn: MIDIEvent; noteOff?: MIDIEvent }[]>();
  
  events.forEach(event => {
    if (event.type !== 'noteOn' && event.type !== 'noteOff') return;
    
    const noteKey = `${event.channel}-${event.note}`;
    
    if (event.type === 'noteOn') {
      if (!noteLifecycles.has(noteKey)) {
        noteLifecycles.set(noteKey, []);
      }
      noteLifecycles.get(noteKey)!.push({ noteOn: event });
    } else if (event.type === 'noteOff') {
      const lifecycle = noteLifecycles.get(noteKey);
      if (lifecycle && lifecycle.length > 0) {
        const lastNote = lifecycle[lifecycle.length - 1];
        if (!lastNote.noteOff) {
          lastNote.noteOff = event;
        }
      }
    }
  });

  // Split into chunks with proper note handling
  const chunks: MIDIEvent[][] = [];
  let currentChunkStart = 0;

  while (currentChunkStart < totalTicks) {
    const chunkEnd = currentChunkStart + maxTicks;
    const chunkEvents: MIDIEvent[] = [];
    const notesToContinue = new Set<string>(); // Notes that continue into next chunk

    // First pass: collect all events in this chunk
    events.forEach(event => {
      if (event.absoluteTime >= currentChunkStart && event.absoluteTime < chunkEnd) {
        chunkEvents.push({
          ...event,
          absoluteTime: event.absoluteTime - currentChunkStart,
        });
      }
    });

    // Second pass: handle cross-boundary notes
    noteLifecycles.forEach((lifecycle, noteKey) => {
      lifecycle.forEach(({ noteOn, noteOff }) => {
        const noteStartsBeforeChunk = noteOn.absoluteTime < currentChunkStart;
        const noteEndsAfterChunkStart = !noteOff || noteOff.absoluteTime > currentChunkStart;
        const noteEndsAfterChunkEnd = !noteOff || noteOff.absoluteTime >= chunkEnd;

        // Note started before this chunk and is still playing at chunk start
        if (noteStartsBeforeChunk && noteEndsAfterChunkStart) {
          // Insert synthetic noteOn at chunk start
          chunkEvents.push({
            type: 'noteOn',
            deltaTime: 0,
            absoluteTime: 0,
            channel: noteOn.channel,
            note: noteOn.note,
            velocity: noteOn.velocity,
          });

          // If note ends within this chunk, the noteOff is already added
          // If note continues beyond chunk, mark it for closing
          if (noteEndsAfterChunkEnd) {
            notesToContinue.add(noteKey);
          }
        }

        // Note starts in this chunk but ends after chunk boundary
        if (noteOn.absoluteTime >= currentChunkStart && 
            noteOn.absoluteTime < chunkEnd && 
            noteEndsAfterChunkEnd) {
          notesToContinue.add(noteKey);
        }
      });
    });

    // Close notes that continue beyond chunk boundary
    notesToContinue.forEach(noteKey => {
      const [channel, note] = noteKey.split('-').map(Number);
      chunkEvents.push({
        type: 'noteOff',
        deltaTime: 0,
        absoluteTime: maxTicks - 1,
        channel,
        note,
        velocity: 0,
      });
    });

    // Sort by absolute time
    chunkEvents.sort((a, b) => a.absoluteTime - b.absoluteTime);

    // Recalculate delta times for this chunk
    let lastTime = 0;
    chunkEvents.forEach(event => {
      event.deltaTime = event.absoluteTime - lastTime;
      lastTime = event.absoluteTime;
    });

    chunks.push(chunkEvents);
    currentChunkStart = chunkEnd;
  }

  return chunks;
}

export function filterSupportedEvents(events: MIDIEvent[]): MIDIEvent[] {
  const supported = ['noteOn', 'noteOff', 'cc', 'programChange', 'pitchBend', 'aftertouch', 'channelAftertouch', 'meta'];
  return events.filter(e => supported.includes(e.type));
}
