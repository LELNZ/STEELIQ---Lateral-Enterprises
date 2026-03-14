import { useQuery } from "@tanstack/react-query";

export type SystemMode = "development" | "demo" | "production";

export function useSystemMode() {
  const { data, isLoading } = useQuery<{ systemMode: SystemMode }>({
    queryKey: ["/api/settings/system-mode"],
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  return {
    mode: (data?.systemMode ?? null) as SystemMode | null,
    resolvedMode: (data?.systemMode ?? "development") as SystemMode,
    isLoading,
  };
}
