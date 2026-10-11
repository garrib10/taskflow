import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import Button from "./Button";

it("forwards native attributes, ref, accessible name and mouse events", async () => {
  const user = userEvent.setup(), click = vi.fn(), ref = createRef<HTMLButtonElement>();
  render(<Button ref={ref} id="retry" name="intent" value="retry" aria-label="Retry saving" aria-describedby="reason" data-initial-focus className="local" variant="secondary" onClick={click}>Retry</Button>);
  const button = screen.getByRole("button", { name: "Retry saving" });
  expect(ref.current).toBe(button);
  expect(button).toHaveAttribute("id", "retry");
  expect(button).toHaveAttribute("name", "intent");
  expect(button).toHaveAttribute("value", "retry");
  expect(button).toHaveAttribute("aria-describedby", "reason");
  expect(button).toHaveAttribute("data-initial-focus");
  expect(button).toHaveClass("ui-button--secondary", "local");
  await user.click(button); expect(click).toHaveBeenCalledOnce();
});

it("uses native Enter and Space activation without handlers that emulate keys", async () => {
  const user = userEvent.setup(), click = vi.fn();
  render(<Button onClick={click}>Save</Button>);
  await user.tab(); expect(screen.getByRole("button")).toHaveFocus();
  await user.keyboard("{Enter} "); expect(click).toHaveBeenCalledTimes(2);
});

it("prevents disabled mouse/keyboard activation and removes the button from tab order", async () => {
  const user = userEvent.setup(), click = vi.fn();
  render(<><Button disabled onClick={click}>Unavailable</Button><Button>Available</Button></>);
  const disabled = screen.getByRole("button", { name: "Unavailable" });
  await user.click(disabled); await user.tab();
  expect(screen.getByRole("button", { name: "Available" })).toHaveFocus();
  disabled.focus(); await user.keyboard("{Enter} ");
  expect(click).not.toHaveBeenCalled(); expect(disabled).toBeDisabled();
});

it("defaults to a non-submitting action and honors explicit submit intent/destructive variant", async () => {
  const user = userEvent.setup(), submit = vi.fn();
  render(<form onSubmit={event => { event.preventDefault(); submit(); }}><Button>Cancel</Button><Button type="submit" variant="danger">Delete</Button></form>);
  await user.click(screen.getByRole("button", { name: "Cancel" })); expect(submit).not.toHaveBeenCalled();
  const danger = screen.getByRole("button", { name: "Delete" });
  expect(danger).toHaveClass("ui-button--danger");
  await user.click(danger); expect(submit).toHaveBeenCalledOnce();
});
