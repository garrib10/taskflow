import type { ComponentPropsWithRef } from "react";
import "./Button.css";
import ActionIcon, { type ActionIconName } from "../ActionIcon/ActionIcon";

export type ButtonProps = ComponentPropsWithRef<"button"> & {
  icon?: ActionIconName;
  variant?: "primary" | "secondary" | "danger";
};

/** Native button behavior, including refs and explicit submit intent. */
export default function Button({
  variant = "primary", type = "button", className = "", icon, children, ...props
}: ButtonProps) {
  return <button {...props} type={type} className={`ui-button ui-button--${variant}${className ? ` ${className}` : ""}`}>{icon && <ActionIcon name={icon}/>}{children}</button>;
}
