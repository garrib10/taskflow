import { useCallback, useEffect, useState } from "react";
import { createNotification, type NotificationVariant, type TaskNotification } from "./notification";

/** The same controller handles local outcomes and notices owned by the persistence boundary.
 * Separate instances keep storage problems available during routine board actions.
 */
export function useNotification(source?: TaskNotification | null) {
  const [state, setState] = useState({ source, notification: source ?? null });
  // Adopt a new boundary snapshot before rendering children. An unchanged source
  // stays dismissed; no effect replays it and stale timer callbacks only match IDs.
  if (source !== state.source) setState({ source, notification: source ?? null });
  const notification = state.notification;

  const show = useCallback((variant: NotificationVariant, message: string) => {
    const next = createNotification(variant, message);
    setState(current => ({ ...current, notification: next }));
    return next;
  }, []);
  const dismiss = useCallback((id: string) => {
    setState(current => current.notification?.id === id ? { ...current, notification: null } : current);
  }, []);

  useEffect(() => {
    if (notification?.dismissal !== "automatic") return;
    const timer = window.setTimeout(() => dismiss(notification.id), notification.durationMs);
    return () => window.clearTimeout(timer);
  }, [notification, dismiss]);

  return { notification, show, dismiss };
}
