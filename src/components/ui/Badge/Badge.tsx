import type { ComponentPropsWithRef } from "react";
import "./Badge.css";

/** Shared metadata shape; feature owners supply meaningful text and color roles. */
export default function Badge({ className = "", ...props }: ComponentPropsWithRef<"span">) {
  return <span {...props} className={`ui-badge${className ? ` ${className}` : ""}`} />;
}
