import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Explicit imports leave no global afterEach for Testing Library's auto-cleanup.
afterEach(cleanup);
