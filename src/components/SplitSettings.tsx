import { Settings } from 'lucide-react';
import { Card } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import type { SplitSettings as SplitSettingsType } from '@/lib/midi/types';
interface SplitSettingsProps {
  settings: SplitSettingsType;
  onSettingsChange: (settings: SplitSettingsType) => void;
}
export function SplitSettings({
  settings,
  onSettingsChange
}: SplitSettingsProps) {
  const handleStepsPerBarChange = (value: string) => {
    const num = parseInt(value);
    if (!isNaN(num) && num > 0 && num <= 64) {
      onSettingsChange({
        ...settings,
        stepsPerBar: num
      });
    }
  };

  const handleMaxStepsChange = (value: string) => {
    const num = parseInt(value);
    if (!isNaN(num) && num > 0) {
      onSettingsChange({
        ...settings,
        maxStepsPerClip: num
      });
    }
  };

  const handlePPQChange = (value: string) => {
    const num = parseInt(value);
    if (!isNaN(num) && num > 0) {
      onSettingsChange({
        ...settings,
        ppq: num
      });
    }
  };
  return <Card className="p-6">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Split Settings</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label htmlFor="stepsPerBar">Steps per Bar</Label>
            <Input id="stepsPerBar" type="number" min="1" max="64" value={settings.stepsPerBar} onChange={e => handleStepsPerBarChange(e.target.value)} className="font-mono" />
            
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxSteps">Max Steps per Clip</Label>
            <Input id="maxSteps" type="number" min="1" value={settings.maxStepsPerClip} onChange={e => handleMaxStepsChange(e.target.value)} className="font-mono" />
            
          </div>

          <div className="space-y-2">
            <Label htmlFor="ppq">PPQ (Ticks/Beat)</Label>
            <Input id="ppq" type="number" min="1" value={settings.ppq} onChange={e => handlePPQChange(e.target.value)} className="font-mono" />
            
          </div>
        </div>

        <div className="p-4 bg-accent/30 rounded-lg border border-border">
          <p className="text-sm text-muted-foreground">
            Patterns longer than 128 steps will be automatically split into multiple clips.
            Each clip will be exported as a separate .mid file (e.g., A_1.mid, A_2.mid).
          </p>
        </div>
      </div>
    </Card>;
}