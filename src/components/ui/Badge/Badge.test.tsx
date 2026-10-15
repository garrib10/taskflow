import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import Badge from "./Badge";

it("retains textual meaning, native span attributes and feature color ownership without becoming a live region", () => {
  const ref = createRef<HTMLSpanElement>();
  render(<Badge ref={ref} className="badge-medium" id="priority" aria-label="Priority: Medium" title="Medium priority">Medium</Badge>);
  const badge = screen.getByText("Medium");
  expect(badge.tagName).toBe("SPAN"); expect(ref.current).toBe(badge);
  expect(badge).toHaveAttribute("aria-label", "Priority: Medium");
  expect(badge).toHaveAttribute("id", "priority"); expect(badge).toHaveAttribute("title", "Medium priority");
  expect(badge).toHaveClass("ui-badge", "badge-medium");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
