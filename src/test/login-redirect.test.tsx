import { render, act, waitFor, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const navigate = vi.fn();
let authState: any = { isAuthenticated: false, signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn() };

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    createFileRoute: () => (opts: any) => ({
      options: opts,
      useSearch: () => ({}),
    }),
    useNavigate: () => navigate,
    Link: ({ children }: any) => React.createElement("a", null, children),
  };
});

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => authState }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ is: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
      }),
    }),
    auth: { resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }) },
  },
}));

async function renderLogin() {
  const mod = await import("@/routes/login");
  const Component = (mod.Route as any).options.component;
  await act(async () => {
    render(<Component />);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authState = { isAuthenticated: false, signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn() };
});

describe("inloggningssidan", () => {
  it("visar formuläret när användaren är utloggad", async () => {
    await renderLogin();
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/e-post/i)).toBeInTheDocument();
  });

  it("skickar redan inloggade vidare till panelväljaren", async () => {
    authState = { ...authState, isAuthenticated: true };
    await renderLogin();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/valj-panel" }));
  });
});
