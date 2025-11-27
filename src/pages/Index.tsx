import { useState } from 'react';
import { Disc3 } from 'lucide-react';
import { UploadPanel } from '@/components/UploadPanel';
import { MidiPlayer } from '@/components/MidiPlayer';
import { TrackInspector } from '@/components/TrackInspector';
import { SplitSettings } from '@/components/SplitSettings';
import { SummaryPanel } from '@/components/SummaryPanel';
import { ExportPanel } from '@/components/ExportPanel';
import { parseMIDIFile } from '@/lib/midi/parser';
import { useMidiPlayer } from '@/hooks/useMidiPlayer';
import { toast } from 'sonner';
import type { ParsedMIDI, OutputTrackConfig, SplitSettings as SplitSettingsType } from '@/lib/midi/types';
const Index = () => {
  const [parsedMidi, setParsedMidi] = useState<ParsedMIDI | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [configs, setConfigs] = useState<Map<string, OutputTrackConfig>>(new Map());
  const [splitSettings, setSplitSettings] = useState<SplitSettingsType>({
    stepsPerBar: 16,
    maxStepsPerClip: 128,
    ppq: 480
  });
  const {
    isPlaying,
    position,
    duration,
    isInitialized,
    isLoading,
    loadingProgress,
    trackStates,
    play,
    pause,
    stop,
    seek,
    toggleMute,
    toggleSolo
  } = useMidiPlayer(parsedMidi);
  const handleFileSelect = async (file: File) => {
    setIsProcessing(true);
    setParsedMidi(null);
    setConfigs(new Map());
    try {
      const parsed = await parseMIDIFile(file);
      setParsedMidi(parsed);
      setSplitSettings(prev => ({
        ...prev,
        ppq: parsed.header.ppq
      }));
      toast.success('MIDI file loaded', {
        description: `Found ${parsed.tracks.length} tracks, ${parsed.header.ppq} PPQ`
      });
    } catch (error) {
      console.error('Parse error:', error);
      toast.error('Failed to parse MIDI file', {
        description: error instanceof Error ? error.message : 'Invalid MIDI format'
      });
    } finally {
      setIsProcessing(false);
    }
  };
  return <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <header className="mb-12 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full" />
              <Disc3 className="w-12 h-12 text-primary relative z-10 animate-spin" style={{
              animationDuration: '8s'
            }} />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">MIDI Splitter</h1>
          </div>
          
        </header>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Upload Section */}
          <UploadPanel onFileSelect={handleFileSelect} isProcessing={isProcessing} />

          {/* Configuration Section - Only show when file is loaded */}
          {parsedMidi && <>
              <MidiPlayer isPlaying={isPlaying} position={position} duration={duration} isInitialized={isInitialized} isLoading={isLoading} loadingProgress={loadingProgress} onPlay={play} onPause={pause} onStop={stop} onSeek={seek} />

              <TrackInspector tracks={parsedMidi.tracks} configs={configs} onConfigChange={setConfigs} trackStates={trackStates} onToggleMute={toggleMute} onToggleSolo={toggleSolo} />

              <SplitSettings settings={splitSettings} onSettingsChange={setSplitSettings} />

              <SummaryPanel parsedMidi={parsedMidi} configs={configs} settings={splitSettings} />

              <ExportPanel parsedMidi={parsedMidi} configs={configs} settings={splitSettings} />
            </>}
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-sm text-muted-foreground">
          <p>
            Made with 🤖❤️🎹 by{" "}
            <a 
              href="https://lucatronico.w.link/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              LucaTronico
            </a>
          </p>
        </footer>
      </div>
    </div>;
};
export default Index;