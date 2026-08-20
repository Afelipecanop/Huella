import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook } from "@testing-library/react-native";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

// @testing-library/react-native's render() is async (wraps the initial
// render in act() for concurrent-React support) — this wrapper stays async
// too, and every call site must `await renderWithQueryClient(...)`.
export async function renderWithQueryClient(ui: ReactElement) {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

// @testing-library/react-native's renderHook() is async in the installed
// version too (same act()-wrapping as render()) — this wrapper stays async,
// and every call site must `await renderHookWithQueryClient(...)`.
export async function renderHookWithQueryClient<TResult, TProps>(
  callback: (props: TProps) => TResult,
) {
  const queryClient = createTestQueryClient();
  return renderHook(callback, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}
