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

  // Split into chunks with proper note handling
  const chunks: MIDIEvent[][] = [];
  let currentChunkStart = 0;

  while (currentChunkStart < totalTicks) {
    const chunkEnd = currentChunkStart + maxTicks;
    const chunkEvents: MIDIEvent[] = [];
    const activeNotes = new Map<string, MIDIEvent>(); // Track active notes

    // Collect events in this chunk
    events.forEach(event => {
      const noteKey = `${event.channel}-${event.note}`;

      if (event.absoluteTime >= currentChunkStart && event.absoluteTime < chunkEnd) {
        const adjustedEvent = {
          ...event,
          absoluteTime: event.absoluteTime - currentChunkStart,
        };
        chunkEvents.push(adjustedEvent);

        // Track note on/off for hanging note detection
        if (event.type === 'noteOn') {
          activeNotes.set(noteKey, adjustedEvent);
        } else if (event.type === 'noteOff') {
          activeNotes.delete(noteKey);
        }
      } else if (event.absoluteTime >= chunkEnd) {
        // For notes that end after chunk boundary, insert a noteOff at boundary
        if (event.type === 'noteOff' && activeNotes.has(noteKey)) {
          chunkEvents.push({
            ...event,
            absoluteTime: maxTicks - 1, // End just before boundary
          });
          activeNotes.delete(noteKey);
        }
      }
    });

    // Close any remaining active notes at chunk boundary
    activeNotes.forEach((noteOnEvent) => {
      chunkEvents.push({
        type: 'noteOff',
        deltaTime: 0,
        absoluteTime: maxTicks - 1,
        channel: noteOnEvent.channel,
        note: noteOnEvent.note,
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
