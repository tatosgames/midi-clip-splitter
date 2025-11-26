import { useState } from 'react';
import { Download, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { toast } from 'sonner';
import type { ParsedMIDI, OutputTrackConfig, SplitSettings, ExportFile, ExportMetadata } from '@/lib/midi/types';
import { mergeTracks, splitEventsBySteps } from '@/lib/midi/transform';
import { writeMIDIFile } from '@/lib/midi/writer';
import { createExportZip } from '@/lib/zip/package';
import { ticksToSteps } from '@/lib/midi/parser';

interface ExportPanelProps {
  parsedMidi: ParsedMIDI;
  configs: Map<string, OutputTrackConfig>;
  settings: SplitSettings;
}

export function ExportPanel({ parsedMidi, configs, settings }: ExportPanelProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const handleExport = async () => {
    if (configs.size === 0) {
      toast.error('No tracks configured', {
        description: 'Please assign at least one source track to an output.',
      });
      return;
    }

    setIsExporting(true);
    setIsComplete(false);

    try {
      const exportFiles: ExportFile[] = [];

      // Process each output track
      for (const [trackId, config] of configs.entries()) {
        const mergedEvents = mergeTracks(parsedMidi.tracks, config);
        
        if (mergedEvents.length === 0) {
          continue;
        }

        const splitEvents = splitEventsBySteps(
          mergedEvents,
          settings.maxStepsPerClip,
          settings.ppq,
          settings.stepsPerBar
        );

        splitEvents.forEach((events, index) => {
          const splitIndex = splitEvents.length > 1 ? index + 1 : undefined;
          const filename = splitIndex 
            ? `${trackId}_${splitIndex}.mid`
            : `${trackId}.mid`;

          const midiData = writeMIDIFile(
            events,
            settings.ppq,
            `MC-101 Track ${trackId}`
          );

          const startStep = index * settings.maxStepsPerClip;
          const endStep = Math.min(
            startStep + settings.maxStepsPerClip,
            ticksToSteps(parsedMidi.duration, settings.ppq, settings.stepsPerBar)
          );

          exportFiles.push({
            filename,
            data: midiData,
            trackId: trackId as 'A' | 'B' | 'C' | 'D',
            splitIndex,
            stepRange: { start: startStep, end: endStep },
          });
        });
      }

      const metadata: ExportMetadata = {
        generatedAt: new Date().toISOString(),
        sourceFile: parsedMidi.fileName,
        ppq: settings.ppq,
        splitSettings: settings,
        files: exportFiles.map(f => ({
          filename: f.filename,
          trackId: f.trackId,
          splitIndex: f.splitIndex,
          stepRange: f.stepRange,
          sourceTracks: configs.get(f.trackId)?.sourceTracks || [],
        })),
      };

      const zipBlob = await createExportZip(exportFiles, metadata);
      
      // Trigger download
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MC101_${parsedMidi.fileName.replace('.mid', '')}_export.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIsComplete(true);
      toast.success('Export complete!', {
        description: `Generated ${exportFiles.length} MIDI files ready for MC-101`,
      });

    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export failed', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex flex-col items-center gap-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold">Ready to Export</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Generate a ZIP package containing your MC-101 ready MIDI clips, 
            along with instructions and metadata
          </p>
        </div>

        <Button
          size="lg"
          onClick={handleExport}
          disabled={isExporting || configs.size === 0}
          className="w-full md:w-auto min-w-[200px] shadow-glow-cyan"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Generating...
            </>
          ) : isComplete ? (
            <>
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Download Again
            </>
          ) : (
            <>
              <Download className="w-5 h-5 mr-2" />
              Generate ZIP
            </>
          )}
        </Button>

        {isComplete && (
          <p className="text-xs text-muted-foreground">
            Your ZIP file should download automatically. If not, click the button again.
          </p>
        )}
      </div>
    </Card>
  );
}
