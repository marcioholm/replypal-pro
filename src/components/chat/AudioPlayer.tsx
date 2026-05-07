
import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Download, Volume2, FastForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatTime } from '@/lib/store';

interface AudioPlayerProps {
  url: string;
  sender: 'client' | 'agent';
}

export function AudioPlayer({ url, sender }: AudioPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);

  const primaryColor = sender === 'agent' ? '#ffffff' : '#3b82f6';
  const secondaryColor = sender === 'agent' ? 'rgba(255,255,255,0.3)' : 'rgba(59,130,246,0.2)';

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: secondaryColor,
      progressColor: primaryColor,
      cursorColor: 'transparent',
      barWidth: 2,
      barGap: 3,
      barRadius: 30,
      responsive: true,
      height: 35,
      normalize: true,
      backend: 'MediaElement',
    });

    ws.load(url);

    ws.on('ready', () => {
      setDuration(ws.getDuration());
      wavesurfer.current = ws;
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => {
      setIsPlaying(false);
      ws.seekTo(0);
    });
    
    ws.on('audioprocess', () => {
      setCurrentTime(ws.getCurrentTime());
    });

    return () => {
      ws.destroy();
    };
  }, [url]);

  const togglePlay = () => {
    wavesurfer.current?.playPause();
  };

  const changeSpeed = () => {
    const nextSpeed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(nextSpeed);
    wavesurfer.current?.setPlaybackRate(nextSpeed);
  };

  const downloadAudio = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = 'audio.mp3';
    link.click();
  };

  const formatSeconds = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex flex-col gap-1 w-full min-w-[240px] max-w-[300px] py-1 ${sender === 'agent' ? 'text-primary-foreground' : 'text-foreground'}`}>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={togglePlay}
          className={`h-10 w-10 p-0 rounded-full hover:bg-white/10 shrink-0 ${sender === 'agent' ? 'text-white' : 'text-primary'}`}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 fill-current" />
          ) : (
            <Play className="w-6 h-6 fill-current ml-1" />
          )}
        </Button>
        
        <div className="flex-1 flex flex-col gap-1">
          <div ref={containerRef} className="w-full" />
          <div className="flex justify-between items-center px-0.5">
            <span className="text-[10px] opacity-70 font-medium">
              {formatSeconds(isPlaying ? currentTime : duration)}
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={changeSpeed}
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-current opacity-60 hover:opacity-100 transition-all`}
              >
                {speed}x
              </button>
              <button onClick={downloadAudio} className="opacity-30 hover:opacity-100 transition-opacity p-1">
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
