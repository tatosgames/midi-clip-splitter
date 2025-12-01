import { useCallback, useState } from 'react';
import { Upload, FileMusic } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
interface UploadPanelProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}
export function UploadPanel({
  onFileSelect,
  isProcessing
}: UploadPanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);
  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.mid') || file.name.endsWith('.midi')) {
        onFileSelect(file);
      }
    }
  }, [onFileSelect]);
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  }, [onFileSelect]);

  const handleLoadDemo = useCallback(async () => {
    try {
      const basePath = import.meta.env.PROD ? '/midi-clip-splitter' : '';
      const response = await fetch(`${basePath}/demo.mid`);
      if (!response.ok) throw new Error('Failed to load demo file');
      const blob = await response.blob();
      const file = new File([blob], 'demo.mid', { type: 'audio/midi' });
      onFileSelect(file);
    } catch (error) {
      console.error('Failed to load demo file:', error);
    }
  }, [onFileSelect]);
  return <Card className="p-8">
      <div className={`
          border-2 border-dashed rounded-lg p-12 text-center transition-all duration-300
          ${isDragging ? 'border-primary bg-primary/5 shadow-glow-cyan' : 'border-border hover:border-primary/50 hover:bg-accent/5'}
        `} onDragEnter={handleDragIn} onDragLeave={handleDragOut} onDragOver={handleDrag} onDrop={handleDrop}>
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
            <FileMusic className="w-16 h-16 text-primary relative z-10" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-foreground">
              Upload your multitrack MIDI file
            </h3>
            
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <input type="file" accept=".mid,.midi" onChange={handleFileInput} className="hidden" id="file-input" disabled={isProcessing} />
              <Button asChild size="lg" className="cursor-pointer" disabled={isProcessing}>
                <label htmlFor="file-input">
                  <Upload className="w-5 h-5 mr-2" />
                  {isProcessing ? 'Processing...' : 'Select MIDI File'}
                </label>
              </Button>
            </div>
            
            <button 
              onClick={handleLoadDemo}
              disabled={isProcessing}
              className="text-sm text-muted-foreground hover:text-primary underline transition-colors disabled:opacity-50"
            >
              or try with a demo file
            </button>
          </div>
        </div>
      </div>
    </Card>;
}