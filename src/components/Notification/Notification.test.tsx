import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import Notification from "./Notification";

it("renders an error notification and lets the user request dismissal", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();

  render(
    <Notification
      message="Cannot move this task."
      type="error"
      onClose={onClose}
    />,
  );

  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("Cannot move this task.");

  await user.click(screen.getByRole("button", { name: "Dismiss notification: Cannot move this task." }));

  expect(onClose).toHaveBeenCalledTimes(1);
});
