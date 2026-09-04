import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchLeads } from "@/lib/leads-api";
import type { Lead } from "@/lib/types";

export const LEADS_QUERY_KEY = ["leads"] as const;

/**
 * Delad leads-hämtning med cache – ersätter separata useState/useEffect-kopior
 * i dashboard, leads-vyn och stegvyerna så att samma data bara hämtas en gång.
 */
export function useLeads(enabled = true) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: LEADS_QUERY_KEY,
    queryFn: fetchLeads,
    enabled,
    staleTime: 30_000,
  });

  const reload = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: LEADS_QUERY_KEY });
  }, [queryClient]);

  /** Optimistisk lokal uppdatering av cachen (samma API som setState). */
  const setLeads = useCallback(
    (updater: Lead[] | ((prev: Lead[]) => Lead[])) => {
      queryClient.setQueryData<Lead[]>(LEADS_QUERY_KEY, (prev) =>
        typeof updater === "function" ? updater(prev ?? []) : updater
      );
    },
    [queryClient]
  );

  return {
    leads: data ?? [],
    loading: enabled && isLoading,
    reload,
    setLeads,
  };
}
