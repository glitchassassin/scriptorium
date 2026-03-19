import "@testing-library/jest-dom/vitest";

process.env.SESSION_SECRET ??= "vitest-session-secret-0123456789abcdef0123456789abcdef";

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = MockResizeObserver as typeof ResizeObserver;
}
