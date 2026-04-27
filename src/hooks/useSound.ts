import { useEffect, useRef, useCallback, useState } from "react";
import { getNotificationConfig } from "./useNotifications";

interface UseSoundOptions {
  soundType: "new_message" | "new_conversation" | "sla_warning" | "success";
  volume?: number;
}

const SOUND_URLS = {
  new_message: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleU4APpLmnn9JEhM1lOa0gEoLP5DnnoJMEyE3lvG/hVQTPY/wyIVWFyUAAACMqQ==",
  new_conversation: "data:audio/wav;base64,UklGRl9vT19teleSREZ3R0N3eICJi42QlJWKhoaBjJCOj5KNjIuMiomHhYWEg4OCgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgQ==",
  sla_warning: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleU4APpLmnn9JEhM1lOa0gEoLP5DnnoJMEyE3lvG/hVQTPY/wyIVWFyQAAACMqg==",
  success: "data:audio/wav;base64,UklGRl9vT19teleSREZ3R0N3eICJi42QlJWKhoaBjJCOj5KNjIuMiomHhYWEg4OCgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgQ==",
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