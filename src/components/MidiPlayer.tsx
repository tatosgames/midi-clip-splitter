import { Play, Pause, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';

interface MidiPlayerProps {
  isPlaying: boolean;
  position: number;
  duration: number;
  isInitialized: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (seconds: number) => void;
}

export function MidiPlayer({
  isPlaying,
  position,
  duration,
  isInitialized,
  onPlay,
  onPause,
  onStop,
  onSeek,
}: MidiPlayerProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">MIDI Preview</h3>
          <span className="text-sm text-muted-foreground">
            {formatTime(position)} / {formatTime(duration)}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Slider
            value={[position]}
            max={duration || 100}
            step={0.1}
            onValueChange={([value]) => onSeek(value)}
            disabled={!isInitialized}
            className="cursor-pointer"
          />
          <div className="h-1 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Transport Controls */}
        <div className="flex items-center justify-center gap-2">
          <Button
            onClick={onStop}
            disabled={!isInitialized}
            variant="outline"
            size="icon"
            className="h-10 w-10"
          >
            <Square className="h-4 w-4" />
          </Button>
          <Button
            onClick={isPlaying ? onPause : onPlay}
            disabled={!isInitialized}
            size="icon"
            className="h-12 w-12"
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>
        </div>

        {!isInitialized && (
          <p className="text-center text-sm text-muted-foreground">
            Upload a MIDI file to enable preview
          </p>
        )}
      </div>
    </Card>
  );
}
