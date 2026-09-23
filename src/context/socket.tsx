import { useEffect } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { getToken } from "@/lib/api/client";
import { useAuth } from "@/context/auth";
import { useToast } from "@/context/toast";
import type { NotificationData } from "@/types/notification";

// Socket.IO connects to the bare server origin, not the REST /api/v1 base path, so strip VITE_API_URL down to just the origin. It can be absolute (dev) or relative (prod, behind a reverse proxy) — `new URL()` throws on a bare relative path with no base, so window.location.origin is passed as the base to make both forms resolve.
function wsOrigin() {
  const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:7000/api/v1";
  try {
    return new URL(apiUrl, window.location.origin).origin;
  } catch {
    // Last resort — never let a malformed env value crash the app; the socket just won't connect, same as a down server.
    return window.location.origin;
  }
}

interface NotificationPushPayload {
  type: string;
  title: string;
  message: string;
  data: NotificationData;
}

// Pushes a toast + invalidates the notifications query when websocket.service.js emits "notification:new" — NotificationBell.tsx just reads React Query; this drives it live instead of waiting on its refetchInterval fallback.
export function NotificationSocketProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) return;

    const token = getToken();
    if (!token) return;

    const socket = io(wsOrigin(), { auth: { token } });

    socket.on("notification:new", (payload: NotificationPushPayload) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast({ title: payload.title, description: payload.message, tone: "default" });
    });

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, queryClient, toast]);

  return <>{children}</>;
}
