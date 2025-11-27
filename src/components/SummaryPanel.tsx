import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import type { OutputTrackConfig, ParsedMIDI, SplitSettings } from '@/lib/midi/types';
import { calculateSteps } from '@/lib/midi/parser';
interface SummaryPanelProps {
  parsedMidi: ParsedMIDI;
  configs: Map<string, OutputTrackConfig>;
  settings: SplitSettings;
}
export function SummaryPanel({
  parsedMidi,
  configs,
  settings
}: SummaryPanelProps) {
  const totalSteps = calculateSteps(parsedMidi.duration, settings.ppq, settings.stepsPerBar);
  const clipsNeeded = Math.ceil(totalSteps / settings.maxStepsPerClip);
  const warnings: string[] = [];
  if (configs.size > 4) {
    warnings.push('More than 4 output tracks configured. MC-101 supports only A, B, C, D.');
  }
  const hasMultipleTracks = configs.size > 0;
  return <Card className="p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Export Summary</h2>
          {hasMultipleTracks && <Badge variant="secondary" className="bg-primary/10 text-primary">
              Ready to Export
            </Badge>}
        </div>

        {hasMultipleTracks ? <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from(configs.entries()).map(([trackId, config]) => <div key={trackId} className="p-4 bg-accent/30 rounded-lg border border-border">
                  <div className="text-sm text-muted-foreground mb-1">Track {trackId}</div>
                  <div className="text-2xl font-bold text-primary mb-2">
                    {clipsNeeded}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {clipsNeeded === 1 ? 'clip' : 'clips'}
                  </div>
                  <div className="mt-2 pt-2 border-t border-border">
                    <div className="text-xs text-muted-foreground">
                      {config.sourceTracks.length} source {config.sourceTracks.length === 1 ? 'track' : 'tracks'}
                    </div>
                  </div>
                </div>)}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Steps:</span>
                <span className="font-mono font-semibold">{totalSteps}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Files:</span>
                <span className="font-mono font-semibold">
                  {configs.size * clipsNeeded} MIDI + README + metadata.json
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Output Format:</span>
                <span className="font-mono font-semibold">SMF Type 1</span>
              </div>
            </div>

            {warnings.length > 0 && <div className="space-y-2">
                {warnings.map((warning, i) => (
                  <Alert key={i} variant="default">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{warning}</AlertDescription>
                  </Alert>
                ))}
              </div>}

            
          </> : <Alert variant="default">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Assign tracks to outputs A, B, C, or D to see the export summary
            </AlertDescription>
          </Alert>}
      </div>
    </Card>;
}