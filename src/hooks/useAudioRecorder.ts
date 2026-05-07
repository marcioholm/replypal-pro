import { useState, useRef, useCallback } from 'react';

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunks = useRef<Blob[]>([]);
  const onCompleteRef = useRef<((blob: Blob) => void) | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mimeType = MediaRecorder.isTypeSupported('audio/ogg; codecs=opus')
        ? 'audio/ogg; codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm; codecs=opus')
        ? 'audio/webm; codecs=opus'
        : 'audio/webm';
      
      mediaRecorder.current = new MediaRecorder(stream, { mimeType });
      chunks.current = [];

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      mediaRecorder.current.onstop = () => {
        const blob = new Blob(chunks.current, { type: mimeType });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
        if (onCompleteRef.current) {
          onCompleteRef.current(blob);
          onCompleteRef.current = null;
        }
      };

      mediaRecorder.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      setAudioBlob(null);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone error:', err);
      alert('Não foi possível acessar o microfone. Verifique as permissões.');
    }
  }, []);

  // onComplete é chamado QUANDO o blob está pronto (assíncrono)
  const stopRecording = useCallback((onComplete?: (blob: Blob) => void) => {
    if (mediaRecorder.current && isRecording) {
      if (onComplete) onCompleteRef.current = onComplete;
      mediaRecorder.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [isRecording]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorder.current && isRecording) {
      onCompleteRef.current = null;
      mediaRecorder.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setAudioBlob(null);
    }
  }, [isRecording]);

  const clearAudio = useCallback(() => {
    setAudioBlob(null);
    setRecordingTime(0);
  }, []);

  return { isRecording, recordingTime, audioBlob, startRecording, stopRecording, cancelRecording, clearAudio };
}