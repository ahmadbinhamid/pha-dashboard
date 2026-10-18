import { useEffect, useState } from "react";

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function remaining(endsAt: string | null): Countdown | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    expired: ms <= 0,
  };
}

/** Live time left until endsAt, ticking each second, null with no end. */
export function useCountdown(endsAt: string | null) {
  const [value, setValue] = useState(() => remaining(endsAt));
  useEffect(() => {
    setValue(remaining(endsAt));
    if (!endsAt) return;
    const id = window.setInterval(() => setValue(remaining(endsAt)), 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);
  return value;
}
