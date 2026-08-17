import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Automatiska tester för inloggningsflödet:
 * login -> /valj-panel -> rätt panel (auto eller val).
 */

const navigate = vi.fn();
const setSide = vi.fn();
const signOut = vi.fn();

let authState = { isAuthenticated: false, loading: false, signOut, user: null as any };
let roleState = { isInternal: false, isExternal: false, loading: false };

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    createFileRoute: () => (opts: any) => ({ options: opts }),
    useNavigate: () => navigate,
    Link: ({ children }: any) => React.createElement("a", null, children),
    useSearch: () => ({}),
  };
});

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => authState,
}));

vi.mock("@/hooks/use-role", () => ({
  useUserRoles: () => roleState,
}));

vi.mock("@/hooks/use-workspace", () => ({
  useWorkspace: () => ({ side: "extern", setSide, canSwitch: true }),
}));

async function renderPanelPicker() {
  const mod = await import("@/routes/valj-panel");
  const Component = (mod.Route as any).options.component;
  await act(async () => {
    render(<Component />);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  authState = { isAuthenticated: true, loading: false, signOut, user: { id: "u1" } };
  roleState = { isInternal: false, isExternal: false, loading: false };
});

describe("panelväljaren", () => {
  it("skickar oinloggade till /login", async () => {
    authState = { ...authState, isAuthenticated: false };
    await renderPanelPicker();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/login", search: {} }));
  });

  it("visar laddningsläge medan roller hämtas", async () => {
    roleState = { isInternal: false, isExternal: false, loading: true };
    await renderPanelPicker();
    expect(screen.getByText(/Laddar/i)).toBeInTheDocument();
    expect(setSide).not.toHaveBeenCalled();
  });

  it("går direkt till intern när endast interna roller finns", async () => {
    roleState = { isInternal: true, isExternal: false, loading: false };
    await renderPanelPicker();
    await waitFor(() => expect(setSide).toHaveBeenCalledWith("intern"));
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("går direkt till extern när endast externa roller finns", async () => {
    roleState = { isInternal: false, isExternal: true, loading: false };
    await renderPanelPicker();
    await waitFor(() => expect(setSide).toHaveBeenCalledWith("extern"));
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("visar båda valen när användaren har roller på båda sidor", async () => {
    roleState = { isInternal: true, isExternal: true, loading: false };
    await renderPanelPicker();
    expect(screen.getByText("Välj panel")).toBeInTheDocument();
    expect(setSide).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText("Intern"));
    expect(setSide).toHaveBeenCalledWith("intern");
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("låter användaren välja extern panel", async () => {
    roleState = { isInternal: true, isExternal: true, loading: false };
    await renderPanelPicker();
    await userEvent.click(screen.getByText("Extern"));
    expect(setSide).toHaveBeenCalledWith("extern");
  });

  it("visar tydligt fel när kontot saknar roller", async () => {
    roleState = { isInternal: false, isExternal: false, loading: false };
    await renderPanelPicker();
    expect(screen.getByText(/Ingen panel tilldelad/i)).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalledWith({ to: "/" });
    await userEvent.click(screen.getByRole("button", { name: /Logga ut/i }));
    expect(signOut).toHaveBeenCalled();
  });
});
