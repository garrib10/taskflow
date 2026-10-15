import "./ConfirmModal.css";
import Button from "../ui/Button/Button";
import { useId, useRef } from "react";

import { useModalFocus } from "../../accessibility/useModalFocus";

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "danger",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const id = useId();
  useModalFocus(dialogRef, onCancel);

  function handleOverlayMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onCancel();
    }
  }

  return (
    <div className="confirm-modal-overlay" onMouseDown={handleOverlayMouseDown}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-message`}
      >
        <h2 id={`${id}-title`} className="confirm-modal-title">
          {title}
        </h2>

        <p id={`${id}-message`} className="confirm-modal-message">
          {message}
        </p>

        <div className="confirm-modal-actions">
          <Button
            data-initial-focus
            type="button"
            variant="secondary"
            onClick={onCancel}
          >
            {cancelText}
          </Button>

          <Button
            type="button"
            variant={confirmVariant}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
