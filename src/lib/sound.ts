// ============================================================
// Sound utility — Web Audio API beeps/chimes
// No audio files needed, generated programmatically
// ============================================================
import { useSettingsStore } from "@/lib/store/settings-store";
import type { SoundEffect } from "@/lib/store/settings-store";

let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioContext;
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.3
): void {
  const ctx = getContext();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = type;
  oscillator.frequency.value = freq;

  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(
    0.001,
    ctx.currentTime + duration
  );

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + duration);
}

export function playSound(effect: SoundEffect): void {
  if (effect === "none") return;
  const { soundEnabled } = useSettingsStore.getState();
  if (!soundEnabled) return;

  switch (effect) {
    case "chime":
      // Three ascending notes
      playTone(523.25, 0.15, "sine", 0.2); // C5
      setTimeout(() => playTone(659.25, 0.15, "sine", 0.2), 120); // E5
      setTimeout(() => playTone(783.99, 0.3, "sine", 0.2), 240); // G5
      break;
    case "beep":
      playTone(880, 0.15, "square", 0.15);
      break;
    case "click":
      playTone(1000, 0.05, "sine", 0.1);
      break;
  }
}

// Play the configured sound for rest completion
export function playRestCompleteSound(): void {
  const { soundEffect } = useSettingsStore.getState();
  if (soundEffect === "none") return;
  playSound(soundEffect);
}
