import "./Notification.css";
import { useEffectEvent, useLayoutEffect, useRef } from "react";

import { notificationPresentation, type TaskNotification } from "../../notifications/notification";

interface NotificationProps {
  notification: TaskNotification;
  id?: string;
  messageId?: string;
  tabIndex?: number;
  onClose: () => void;
  announce?: boolean;
  onFocusLost?: () => void;
}

export default function Notification({
  notification,
  id,
  messageId,
  tabIndex,
  onClose,
  announce = true,
  onFocusLost,
}: NotificationProps) {
  const ref = useRef<HTMLDivElement>(null);
  const restore = useEffectEvent(() => {
    if (onFocusLost) onFocusLost();
    else document.querySelector<HTMLElement>('[data-focus-fallback]')?.focus();
  });
  useLayoutEffect(() => {
    const element = ref.current;
    return () => { if (element?.contains(document.activeElement)) restore(); };
  }, []);
  const { variant, message } = notification;
  const { icon, label, role } = notificationPresentation[variant];

  return (
    <div
      ref={ref}
      id={id}
      tabIndex={tabIndex}
      className={`notification ${variant}`}
      role={announce ? role : tabIndex !== undefined ? "group" : undefined}
      aria-labelledby={tabIndex !== undefined ? messageId : undefined}
      aria-live={announce ? role === "alert" ? "assertive" : "polite" : "off"}
      aria-atomic="true"
    >
      <span className="notification-icon" aria-hidden="true">
        {icon}
      </span>

      <span id={messageId} className="notification-message">{`${label}: ${message}`}</span>

      <button
        type="button"
        className="notification-close-button"
        onClick={onClose}
        aria-label={`Dismiss notification: ${message}`}
      >
        ×
      </button>
    </div>
  );
}
