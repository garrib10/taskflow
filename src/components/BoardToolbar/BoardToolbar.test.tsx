import { useState } from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import BoardToolbar from "./BoardToolbar";
import SearchBar from "../SearchBar/SearchBar";
import FilterControls from "../FilterControls/FilterControls";

afterEach(() => vi.unstubAllGlobals());
function mobileMedia() {
  const listeners = new Set<() => void>();
  const media = { matches: true, addEventListener: (_: string, fn: () => void) => listeners.add(fn), removeEventListener: (_: string, fn: () => void) => listeners.delete(fn) };
  vi.stubGlobal("matchMedia", () => media);
  return { widen: () => { media.matches = false; listeners.forEach(fn => fn()); } };
}
function Harness() {
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<"all" | "high">("all");
  return <><button data-focus-fallback>Create Task</button><BoardToolbar
    search={<SearchBar searchTerm={query} onSearchChange={setQuery} />}
    filters={<FilterControls priorityFilter={priority} categoryFilter="all" statusFilter="all" onPriorityChange={value => setPriority(value === "high" ? "high" : "all")} onCategoryChange={() => {}} onStatusChange={() => {}} />}
    filterCount={Number(priority !== "all")} activeCriteria={!!query || priority !== "all"}
    onReset={() => { setQuery(""); setPriority("all"); }} ordering={<span>Order: Priority</span>}
    resultSummary={(query || priority !== "all") && <p aria-live="polite">Matching tasks</p>}
  /></>;
}

it("keeps desktop labels, search and reset native and exposes current ordering without a fake selector", async () => {
  const user = userEvent.setup(); render(<Harness />);
  const toolbar = screen.getByRole("search", { name: "Search and filter tasks" });
  expect(within(toolbar).getAllByRole("combobox")).toHaveLength(3);
  expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
  await user.type(screen.getByLabelText("Search:"), "work");
  await user.click(screen.getByRole("button", { name: "Reset" }));
  expect(screen.getByLabelText("Search:")).toHaveValue("");
  expect(screen.getByText("Order: Priority")).toBeInTheDocument();
});

it("applies mobile filters immediately, keeps them on Done/Escape, and restores disclosure focus", async () => {
  mobileMedia(); const user = userEvent.setup(); render(<Harness />);
  const trigger = screen.getByRole("button", { name: "Filters (0)" });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  await user.click(trigger);
  const sheet = screen.getByRole("dialog", { name: "Filter tasks" });
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(within(sheet).getByRole("heading")).toHaveFocus();
  await user.selectOptions(within(sheet).getByLabelText("Priority"), "high");
  expect(screen.getAllByText("Matching tasks")).toHaveLength(1);
  await user.click(within(sheet).getByRole("button", { name: "Done" }));
  expect(screen.getByRole("button", { name: "Filters (1)" })).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(screen.getByLabelText("Priority")).toHaveValue("high");
  expect(screen.getByRole("heading", { name: "Filter tasks" })).toHaveFocus();
  expect(document.querySelector(".toolbar-controls")?.closest("[inert]")).not.toBeNull();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Filters (1)" })).toHaveFocus();
});

it("clears criteria in the sheet without focusing inert Search and contains keyboard navigation", async () => {
  mobileMedia(); const user = userEvent.setup(); render(<Harness />);
  await user.type(screen.getByLabelText("Search:"), "work");
  await user.click(screen.getByRole("button", { name: "Filters (0)" }));
  const sheet = screen.getByRole("dialog");
  await user.selectOptions(within(sheet).getByLabelText("Priority"), "high");
  await user.click(within(sheet).getByRole("button", { name: "Clear all criteria" }));
  expect(within(sheet).getByLabelText("Priority")).toHaveFocus();
  expect(within(sheet).getByLabelText("Priority")).toHaveValue("all");
  expect(within(sheet).getByRole("button", { name: "Clear all criteria" })).toBeDisabled();
  within(sheet).getByRole("button", { name: "Done" }).focus();
  await user.tab(); expect(within(sheet).getByLabelText("Priority")).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(screen.getByLabelText("Search:")).toHaveValue("");
});

it("preserves filters and closes the sheet when resizing to the desktop layout", async () => {
  const media = mobileMedia(), user = userEvent.setup(); render(<Harness />);
  await user.click(screen.getByRole("button", { name: "Filters (0)" }));
  await user.selectOptions(screen.getByLabelText("Priority"), "high");
  await act(async () => media.widen());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Priority")).toHaveValue("high");
  expect(document.querySelector("[inert]")).toBeNull();
});
