import type { MIDITrack, MIDIEvent, OutputTrackConfig } from './types';

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

  const ticksPerStep = (ppq * 4) / stepsPerBar;
  const maxTicks = maxSteps * ticksPerStep;

  // Calculate total duration
  const lastEvent = events[events.length - 1];
  const totalTicks = lastEvent.absoluteTime;
  
  if (totalTicks <= maxTicks) {
    return [events];
  }

  // Split into chunks
  const chunks: MIDIEvent[][] = [];
  let currentChunkStart = 0;

  while (currentChunkStart < totalTicks) {
    const chunkEnd = currentChunkStart + maxTicks;
    const chunkEvents: MIDIEvent[] = [];

    // Collect events in this chunk
    events.forEach(event => {
      if (event.absoluteTime >= currentChunkStart && event.absoluteTime < chunkEnd) {
        const adjustedEvent = {
          ...event,
          absoluteTime: event.absoluteTime - currentChunkStart,
        };
        chunkEvents.push(adjustedEvent);
      }
    });

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
