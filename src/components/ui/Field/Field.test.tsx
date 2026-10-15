import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import Field from "./Field";

it("preserves native label activation, required input and explicit help/error relationships", async () => {
  const user = userEvent.setup(), ref = createRef<HTMLDivElement>();
  render(<Field ref={ref} controlId="title" label="Title" id="field" className="local" data-testid="field">
    <input id="title" required aria-invalid="true" aria-describedby="count error" />
    <small id="count">0/150</small><p id="error">Enter a title.</p>
  </Field>);
  const input = screen.getByRole("textbox", { name: "Title" });
  expect(input).toBeRequired(); expect(input).toHaveAccessibleDescription("0/150 Enter a title.");
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(ref.current).toBe(screen.getByTestId("field"));
  expect(ref.current).toHaveClass("ui-field", "local");
  expect(ref.current).toHaveAttribute("id", "field");
  await user.click(screen.getByText("Title", { selector: "label" })); expect(input).toHaveFocus();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("supports native selects and leaves value/change ownership with the feature", async () => {
  const user = userEvent.setup();
  render(<Field controlId="parent" label="Parent"><select id="parent" defaultValue=""><option value="">No parent</option><option value="p">Parent work</option></select></Field>);
  const select = screen.getByRole("combobox", { name: "Parent" });
  await user.selectOptions(select, "p"); expect(select).toHaveValue("p");
});
