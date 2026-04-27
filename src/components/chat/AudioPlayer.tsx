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
      cursorColor: primaryColor,
      barWidth: 2,
      barRadius: 3,
      responsive: true,
      height: 35,
      normalize: true,
      backend: 'WebAudio',
    });

    ws.load(url);

    ws.on('ready', () => {
      setDuration(ws.getDuration());
      wavesurfer.current = ws;
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => setIsPlaying(false));
    
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
    <div className={`flex flex-col gap-2 w-full max-w-[300px] p-1 ${sender === 'agent' ? 'text-primary-foreground' : 'text-foreground'}`}>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={togglePlay}
          className={`h-8 w-8 p-0 rounded-full hover:bg-white/10 ${sender === 'agent' ? 'text-white' : 'text-primary'}`}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
        </Button>
        
        <div ref={containerRef} className="flex-1" />
        
        <div className="flex flex-col items-end min-w-[35px]">
          <span className="text-[10px] opacity-70">
            {formatSeconds(isPlaying ? currentTime : duration)}
          </span>
          <button 
            onClick={changeSpeed}
            className={`text-[9px] font-bold px-1 rounded border border-current opacity-70 hover:opacity-100 mt-0.5`}
          >
            {speed}x
          </button>
        </div>
      </div>
      
      <div className="flex justify-end gap-2 -mt-1">
         <button onClick={downloadAudio} className="opacity-40 hover:opacity-100 transition-opacity">
           <Download className="w-3 h-3" />
         </button>
      </div>
    </div>
  );
}
