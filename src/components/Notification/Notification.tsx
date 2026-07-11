interface NotificationProps {
  message: string;
}

export default function Notification({ message }: NotificationProps) {
  return <div className="notification">{message}</div>;
}
