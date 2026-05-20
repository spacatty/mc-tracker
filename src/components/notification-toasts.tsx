"use client";

import { useEffect, useRef } from "react";
import { Toaster, toast } from "sonner";
import type { WebsiteNotification } from "@/lib/types";
import { Button } from "./ui/button";

function playNotificationSound() {
  const audioContext = new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.frequency.value = 740;
  oscillator.type = "sine";
  gain.gain.value = 0.04;
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.16);
}

function shouldToast(notification: WebsiteNotification) {
  const title = notification.title.toLowerCase();
  if (title.includes("due today")) return true;
  const dueInMatch = title.match(/due in (\d+) day/);
  if (!dueInMatch) return false;
  const days = Number(dueInMatch[1] || 0);
  return Number.isFinite(days) && days > 0 && days <= 7;
}

export function NotificationToasts({ notifications }: { notifications: WebsiteNotification[] }) {
  const seenToastIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const toastCandidates = notifications.filter(shouldToast);
    const newlySeen = toastCandidates.filter((notification) => {
      if (seenToastIdsRef.current.has(notification.id)) return false;
      seenToastIdsRef.current.add(notification.id);
      return true;
    });

    newlySeen.forEach((notification) => {
      toast(notification.title, {
        id: `notification-${notification.id}`,
        description: notification.body,
        duration: Infinity,
        closeButton: true,
        action: (
          <form action="/app/notifications">
            <Button type="submit" size="sm" variant="secondary">Open center</Button>
          </form>
        ),
      });
    });
    if (newlySeen.length) {
      try {
        playNotificationSound();
      } catch {
        // Browser autoplay rules may block this until the user interacts.
      }
    }
  }, [notifications]);

  return <Toaster theme="dark" richColors closeButton position="top-right" toastOptions={{ className: "border-white/10 bg-zinc-950 text-zinc-100" }} />;
}
