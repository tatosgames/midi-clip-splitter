import { useState } from 'react';
import { Music, Volume2, VolumeX } from 'lucide-react';
import { Card } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
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

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">Include</TableHead>
              <TableHead>Track Name</TableHead>
              <TableHead>Channels</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Events</TableHead>
              <TableHead className="text-center w-[80px]">Mute</TableHead>
              <TableHead className="text-center w-[80px]">Solo</TableHead>
              <TableHead>Assign to</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tracks.map((track) => {
              const trackState = trackStates?.get(track.index) || { muted: false, solo: false };
              return (
                <TableRow key={track.index}>
                  <TableCell>
                    <Checkbox
                      checked={selectedTracks.has(track.index)}
                      onCheckedChange={() => handleTrackToggle(track.index)}
                      aria-label={`Include track ${track.name}`}
                    />
                  </TableCell>

                  <TableCell className="font-medium">
                    {track.name}
                  </TableCell>

                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {Array.from(track.channels).map(ch => (
                        <Badge key={ch} variant="outline" className="text-xs">
                          {ch + 1}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    {track.noteRange 
                      ? `${track.noteRange.min}-${track.noteRange.max}`
                      : '-'
                    }
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    {track.eventCount.toLocaleString()}
                  </TableCell>

                  <TableCell className="text-center">
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
                  </TableCell>

                  <TableCell className="text-center">
                    <Button
                      variant={trackState.solo ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 w-16 font-semibold"
                      onClick={() => onToggleSolo?.(track.index)}
                      disabled={!onToggleSolo}
                    >
                      S
                    </Button>
                  </TableCell>

                  <TableCell>
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
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
