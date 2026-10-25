import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { getToken } from "@/lib/api/client";
import { useAuth } from "@/context/auth";
import { useToast } from "@/context/toast";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { NOTIFICATIONS_QUERY_KEY } from "@/hooks/useNotifications";
import type { NotificationData, NotificationType } from "@/types/notification";

// Socket.IO wants the bare origin; the base resolves a relative (prod) URL.
function wsOrigin() {
  const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:7000/api/v1";
  try {
    return new URL(apiUrl, window.location.origin).origin;
  } catch {
    // A malformed env value must not crash the app; the socket just won't connect.
    return window.location.origin;
  }
}

interface NotificationPushPayload {
  type: NotificationType;
  title: string;
  message: string;
  data: NotificationData;
}

// Live bell updates on "notification:new"; the bell's refetch is a fallback.
export function NotificationSocketProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { preferences } = useNotificationPreferences({ enabled: isAuthenticated });
  // A ref, so flipping the pop-up setting doesn't reconnect the socket.
  const showToastsRef = useRef(true);
  showToastsRef.current = preferences?.show_toasts ?? true;

  useEffect(() => {
    if (!isAuthenticated) return;

    const token = getToken();
    if (!token) return;

    const socket = io(wsOrigin(), { auth: { token } });

    socket.on("notification:new", (payload: NotificationPushPayload) => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      if (!showToastsRef.current) return;
      toast({
        title: payload.title,
        description: payload.message,
        tone: payload.type === "order.overdue" ? "warning" : "default",
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, queryClient, toast]);

  return <>{children}</>;
}
