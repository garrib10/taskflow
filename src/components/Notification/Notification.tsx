interface NotificationProps {
  message: string;
  type?: "success" | "error";
}

export default function Notification({
  message,
  type = "error",
}: NotificationProps) {
  return <div className={`notification ${type}`}>{message}</div>;
}
