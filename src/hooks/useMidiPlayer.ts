import { useState, useEffect, useRef, useCallback } from 'react';
import { MidiPlayer } from '@/lib/midi/player';
import type { ParsedMIDI } from '@/lib/midi/types';

export function useMidiPlayer(parsedMidi: ParsedMIDI | null) {
  const playerRef = useRef<MidiPlayer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [trackStates, setTrackStates] = useState<Map<number, { muted: boolean; solo: boolean }>>(new Map());
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    if (!parsedMidi) {
      setIsInitialized(false);
      return;
    }

    const initPlayer = async () => {
      if (!playerRef.current) {
        playerRef.current = new MidiPlayer();
      }
      
      await playerRef.current.initialize(parsedMidi);
      setDuration(playerRef.current.getDuration());
      setIsInitialized(true);
      
      // Initialize track states
      const states = new Map();
      parsedMidi.tracks.forEach((_, index) => {
        states.set(index, { muted: false, solo: false });
      });
      setTrackStates(states);
    };

    initPlayer();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      playerRef.current?.dispose();
      playerRef.current = null;
    };
  }, [parsedMidi]);

  const updatePosition = useCallback(() => {
    if (playerRef.current && isPlaying) {
      const pos = playerRef.current.getPosition();
      setPosition(pos);

      // Stop when reaching end
      if (pos >= duration && duration > 0) {
        setIsPlaying(false);
        playerRef.current.stop();
        setPosition(0);
        return;
      }

      animationFrameRef.current = requestAnimationFrame(updatePosition);
    }
  }, [isPlaying, duration]);

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updatePosition);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, updatePosition]);

  const play = useCallback(() => {
    if (!playerRef.current || !isInitialized) return;
    playerRef.current.play();
    setIsPlaying(true);
  }, [isInitialized]);

  const pause = useCallback(() => {
    if (!playerRef.current) return;
    playerRef.current.pause();
    setIsPlaying(false);
  }, []);

  const stop = useCallback(() => {
    if (!playerRef.current) return;
    playerRef.current.stop();
    setIsPlaying(false);
    setPosition(0);
  }, []);

  const seek = useCallback((seconds: number) => {
    if (!playerRef.current) return;
    playerRef.current.seek(seconds);
    setPosition(seconds);
  }, []);

  const toggleMute = useCallback((trackIndex: number) => {
    if (!playerRef.current) return;
    
    setTrackStates(prev => {
      const newStates = new Map(prev);
      const current = newStates.get(trackIndex) || { muted: false, solo: false };
      const newMuted = !current.muted;
      newStates.set(trackIndex, { ...current, muted: newMuted });
      playerRef.current?.setTrackMute(trackIndex, newMuted);
      return newStates;
    });
  }, []);

  const toggleSolo = useCallback((trackIndex: number) => {
    if (!playerRef.current) return;
    
    setTrackStates(prev => {
      const newStates = new Map(prev);
      const current = newStates.get(trackIndex) || { muted: false, solo: false };
      const newSolo = !current.solo;
      newStates.set(trackIndex, { ...current, solo: newSolo });
      playerRef.current?.setTrackSolo(trackIndex, newSolo);
      return newStates;
    });
  }, []);

  return {
    isPlaying,
    position,
    duration,
    isInitialized,
    trackStates,
    play,
    pause,
    stop,
    seek,
    toggleMute,
    toggleSolo,
  };
}
