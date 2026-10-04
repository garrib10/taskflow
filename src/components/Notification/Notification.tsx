import "./Notification.css";
import { useEffectEvent, useLayoutEffect, useRef } from "react";

interface NotificationProps {
  message: string;
  type?: "success" | "error";
  onClose: () => void;
  announce?: boolean;
  onFocusLost?: () => void;
}

export default function Notification({
  message,
  type = "error",
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
  const icon = type === "success" ? "✓" : "!";

  const notificationRole = type === "error" ? "alert" : "status";

  return (
    <div
      ref={ref}
      className={`notification ${type}`}
      role={announce ? notificationRole : undefined}
      aria-live={announce ? type === "error" ? "assertive" : "polite" : "off"}
    >
      <span className="notification-icon" aria-hidden="true">
        {icon}
      </span>

      <span className="notification-message">{message}</span>

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
