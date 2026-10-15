import type { ComponentPropsWithRef, ReactNode } from "react";
import "./Field.css";

type FieldProps = ComponentPropsWithRef<"div"> & {
  controlId: string;
  label: ReactNode;
};

/** Layout/label only: callers keep native controls, help/error IDs and ARIA explicit. */
export default function Field({ controlId, label, className = "", children, ...props }: FieldProps) {
  return (
    <div {...props} className={`ui-field${className ? ` ${className}` : ""}`}>
      <label htmlFor={controlId}>{label}</label>
      {children}
    </div>
  );
}
