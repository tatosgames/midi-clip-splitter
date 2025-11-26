import { useState } from 'react';
import { Music, Volume2, VolumeX } from 'lucide-react';
import { Card } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import type { MIDITrack, OutputTrackConfig } from '@/lib/midi/types';

interface TrackInspectorProps {
  tracks: MIDITrack[];
  configs: Map<string, OutputTrackConfig>;
  onConfigChange: (configs: Map<string, OutputTrackConfig>) => void;
  trackStates?: Map<number, { muted: boolean; solo: boolean }>;
  onToggleMute?: (trackIndex: number) => void;
  onToggleSolo?: (trackIndex: number) => void;
}

export function TrackInspector({ 
  tracks, 
  configs, 
  onConfigChange,
  trackStates,
  onToggleMute,
  onToggleSolo,
}: TrackInspectorProps) {
  const [selectedTracks, setSelectedTracks] = useState<Set<number>>(
    new Set(tracks.map((_, i) => i))
  );

  const handleTrackToggle = (trackIndex: number) => {
    const newSelected = new Set(selectedTracks);
    if (newSelected.has(trackIndex)) {
      newSelected.delete(trackIndex);
    } else {
      newSelected.add(trackIndex);
    }
    setSelectedTracks(newSelected);
  };

  const handleAssignmentChange = (trackIndex: number, outputId: string) => {
    const newConfigs = new Map(configs);
    
    // Remove track from all existing configs
    newConfigs.forEach((config, key) => {
      config.sourceTracks = config.sourceTracks.filter(t => t !== trackIndex);
      if (config.sourceTracks.length === 0) {
        newConfigs.delete(key);
      }
    });

    // Add to new assignment if not "None"
    if (outputId !== 'None') {
      const outputKey = outputId as 'A' | 'B' | 'C' | 'D';
      if (!newConfigs.has(outputKey)) {
        newConfigs.set(outputKey, {
          outputId: outputKey,
          sourceTracks: [],
          stripProgramChange: false,
        });
      }
      newConfigs.get(outputKey)!.sourceTracks.push(trackIndex);
    }

    onConfigChange(newConfigs);
  };

  const getAssignment = (trackIndex: number): string => {
    for (const [key, config] of configs.entries()) {
      if (config.sourceTracks.includes(trackIndex)) {
        return key;
      }
    }
    return 'None';
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Music className="w-5 h-5 text-primary" />
            Track Mapping
          </h2>
          <Badge variant="secondary">
            {tracks.length} {tracks.length === 1 ? 'Track' : 'Tracks'}
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-[auto,2fr,1fr,1fr,1fr,auto,auto,1fr] gap-4 px-4 py-2 text-sm font-medium text-muted-foreground border-b">
            <div>Include</div>
            <div>Track Name</div>
            <div>Channels</div>
            <div>Notes</div>
            <div>Events</div>
            <div className="text-center">Mute</div>
            <div className="text-center">Solo</div>
            <div>Assign to</div>
          </div>

          {tracks.map((track) => {
            const trackState = trackStates?.get(track.index) || { muted: false, solo: false };
            return (
              <div
                key={track.index}
                className="grid grid-cols-[auto,2fr,1fr,1fr,1fr,auto,auto,1fr] gap-4 px-4 py-3 rounded-lg hover:bg-accent/50 transition-colors items-center"
              >
                <div className="flex items-center">
                  <Checkbox
                    checked={selectedTracks.has(track.index)}
                    onCheckedChange={() => handleTrackToggle(track.index)}
                    aria-label={`Include track ${track.name}`}
                  />
                </div>

                <div className="flex items-center">
                  <span className="font-medium truncate">{track.name}</span>
                </div>

                <div className="flex items-center gap-1 flex-wrap">
                  {Array.from(track.channels).map(ch => (
                    <Badge key={ch} variant="outline" className="text-xs">
                      {ch + 1}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center text-sm text-muted-foreground">
                  {track.noteRange 
                    ? `${track.noteRange.min}-${track.noteRange.max}`
                    : '-'
                  }
                </div>

                <div className="flex items-center text-sm text-muted-foreground">
                  {track.eventCount.toLocaleString()}
                </div>

                <div className="flex items-center justify-center">
                  <Button
                    variant={trackState.muted ? 'default' : 'outline'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onToggleMute?.(track.index)}
                    disabled={!onToggleMute}
                  >
                    {trackState.muted ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <div className="flex items-center justify-center">
                  <Button
                    variant={trackState.solo ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 w-16 font-semibold"
                    onClick={() => onToggleSolo?.(track.index)}
                    disabled={!onToggleSolo}
                  >
                    S
                  </Button>
                </div>

                <div className="flex items-center">
                  <Select
                    value={getAssignment(track.index)}
                    onValueChange={(value) => handleAssignmentChange(track.index, value)}
                    disabled={!selectedTracks.has(track.index)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="None">None</SelectItem>
                      <SelectItem value="A">Track A</SelectItem>
                      <SelectItem value="B">Track B</SelectItem>
                      <SelectItem value="C">Track C</SelectItem>
                      <SelectItem value="D">Track D</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
