interface NotificationProps {
  message: string;
  type?: "success" | "error";
  onClose: () => void;
}

export default function Notification({
  message,
  type = "error",
  onClose,
}: NotificationProps) {
  const icon = type === "success" ? "✓" : "!";

  const notificationRole = type === "error" ? "alert" : "status";

  return (
    <div
      className={`notification ${type}`}
      role={notificationRole}
      aria-live={type === "error" ? "assertive" : "polite"}
    >
      <span className="notification-icon" aria-hidden="true">
        {icon}
      </span>

      <span className="notification-message">{message}</span>

      <button
        type="button"
        className="notification-close-button"
        onClick={onClose}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
}
