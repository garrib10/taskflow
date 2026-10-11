import type { ComponentPropsWithRef } from "react";
import "./Button.css";

export type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: "primary" | "secondary" | "danger";
};

/** Native button behavior, including refs and explicit submit intent. */
export default function Button({
  variant = "primary", type = "button", className = "", ...props
}: ButtonProps) {
  return <button {...props} type={type} className={`ui-button ui-button--${variant}${className ? ` ${className}` : ""}`} />;
}
