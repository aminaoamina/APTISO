const playSound = (path: string) => {
  if (typeof window === 'undefined') return;

  const audio = new Audio(path);
  audio.volume = 0.7;
  void audio.play().catch(() => {
    // Browsers can block playback until the user has interacted with the page.
  });
};

export const playNotificationSound = () => playSound('/sounds/notification.wav');
export const playPopupSound = () => playSound('/sounds/pop-alert.mp3');