import { useEffect, useRef, useCallback, useState } from "react";
import { getNotificationConfig } from "./useNotifications";

interface UseSoundOptions {
  soundType: "new_message" | "new_conversation" | "sla_warning" | "success";
  volume?: number;
}

const SOUND_URLS = {
  new_message: "https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3", // Click nítido
  new_conversation: "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3", // Alerta de recepção
  sla_warning: "https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3", // Alerta persistente
  success: "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3",
};

export function useSound(options: UseSoundOptions) {
  const { soundType, volume = 0.5 } = options;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const config = getNotificationConfig();
    setIsMuted(!config.enabled);
  }, []);

  useEffect(() => {
    const audio = new Audio(SOUND_URLS[soundType]);
    audio.volume = volume;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [soundType, volume]);

  const play = useCallback(() => {
    if (isMuted || !audioRef.current) return;
    
    try {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch {
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  return { play, isMuted, toggleMute };
}

export function useNewMessageSound() {
  return useSound({ soundType: "new_message", volume: 0.3 });
}

export function useNewConversationSound() {
  return useSound({ soundType: "new_conversation", volume: 0.5 });
}

export function useSLAWarningSound() {
  return useSound({ soundType: "sla_warning", volume: 0.7 });
}

export function useSuccessSound() {
  return useSound({ soundType: "success", volume: 0.4 });
}

interface NotificationSoundOptions {
  type: "new_conversation" | "new_message" | "sla_warning";
  count?: number;
}

export function playNotificationSound({ type, count = 1 }: NotificationSoundOptions) {
  if (count === 0) return;
  
  try {
    const audio = new Audio(SOUND_URLS[type]);
    audio.volume = 0.4;
    audio.play().catch(() => {});
  } catch {
  }
}