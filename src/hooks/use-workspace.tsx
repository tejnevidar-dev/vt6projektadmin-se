import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useUserRoles, type Side } from "@/hooks/use-role";

interface WorkspaceState {
  side: Side;
  setSide: (s: Side) => void;
  canSwitch: boolean;
}

const WorkspaceContext = createContext<WorkspaceState | null>(null);

const STORAGE_KEY = "vt6.workspace.side";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { isAdmin, isInternal, isExternal, loading } = useUserRoles();
  const [side, setSideState] = useState<Side>(() => {
    if (typeof window === "undefined") return "extern";
    return (localStorage.getItem(STORAGE_KEY) as Side) || "extern";
  });

  // När rollerna är laddade, se till att sidan matchar användarens behörighet
  useEffect(() => {
    if (loading) return;
    if (isAdmin) return; // admin får välja fritt
    if (isInternal && !isExternal && side !== "intern") {
      setSideState("intern");
    } else if (isExternal && !isInternal && side !== "extern") {
      setSideState("extern");
    } else if (!isInternal && !isExternal && side !== "extern") {
      // Inga sidospecifika roller (t.ex. viewer) – visa extern som standard
      setSideState("extern");
    }
  }, [loading, isAdmin, isInternal, isExternal, side]);

  const setSide = (s: Side) => {
    setSideState(s);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, s);
  };

  return (
    <WorkspaceContext.Provider value={{ side, setSide, canSwitch: isAdmin }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
