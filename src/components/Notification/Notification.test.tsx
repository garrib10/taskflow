import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import Notification from "./Notification";
import { createNotification } from "../../notifications/notification";

it("renders an error notification and lets the user request dismissal", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();

  render(
    <Notification
      notification={createNotification("error", "Cannot move this task.")}
      onClose={onClose}
    />,
  );

  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("Cannot move this task.");

  await user.click(screen.getByRole("button", { name: "Dismiss notification: Cannot move this task." }));

  expect(onClose).toHaveBeenCalledTimes(1);
});

it.each([
  ["success", "Success", "status"], ["info", "Information", "status"],
  ["warning", "Warning", "status"], ["error", "Error", "alert"],
] as const)("renders %s with text meaning and appropriate announcement semantics", (variant, label, role) => {
  render(<Notification notification={createNotification(variant, "Outcome")} onClose={() => {}} />);
  const notice = screen.getByRole(role);
  expect(notice).toHaveTextContent(`${label}: Outcome`);
  expect(notice).toHaveClass(variant);
  expect(notice).toHaveAttribute("aria-live", role === "alert" ? "assertive" : "polite");
  expect(screen.getByRole("button", { name: "Dismiss notification: Outcome" })).toBeEnabled();
});

it("does not announce a visible notification when its owner supplies the live region", () => {
  render(<Notification notification={createNotification("warning", "Finish children")} announce={false} onClose={() => {}} />);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByText("Warning: Finish children").closest(".notification")).toHaveAttribute("aria-live", "off");
});
