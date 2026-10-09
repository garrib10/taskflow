import "./ConfirmModal.css";
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
          <button
            data-initial-focus
            type="button"
            className="confirm-modal-cancel-button"
            onClick={onCancel}
          >
            {cancelText}
          </button>

          <button
            type="button"
            className={`confirm-modal-confirm-button ${confirmVariant}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
