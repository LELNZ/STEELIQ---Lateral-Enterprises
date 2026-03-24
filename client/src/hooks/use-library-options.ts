import { useQuery } from "@tanstack/react-query";
import type { LibraryEntry } from "@shared/schema";
import { getGlassCombos, getAvailableThicknesses } from "@shared/glass-library";
import { WIND_ZONES, LINER_TYPES, getFrameTypesForCategory, getHandlesForCategory, getLocksForCategory, LOCK_CATEGORIES } from "@shared/item-options";

export interface SelectOption {
  value: string;
  label: string;
}

export function useLibraryOptions() {
  const fetchLib = (type: string) => async () => {
    const res = await fetch(`/api/library?type=${type}`);
    if (!res.ok) throw new Error("Failed");
    return res.json() as Promise<LibraryEntry[]>;
  };

  const { data: libFrameTypes = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "frame_type"], queryFn: fetchLib("frame_type") });
  const { data: libGlass = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "glass"], queryFn: fetchLib("glass") });
  const { data: libLiners = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "liner_type"], queryFn: fetchLib("liner_type") });
  const { data: libWindowHandles = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "window_handle"], queryFn: fetchLib("window_handle") });
  const { data: libDoorHandles = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "door_handle"], queryFn: fetchLib("door_handle") });
  const { data: libEntranceDoorLocks = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "entrance_door_lock"], queryFn: fetchLib("entrance_door_lock") });

  const frameTypeOptions = (cat = "windows-standard"): SelectOption[] => {
    const fromDb = libFrameTypes.filter(e => {
      const d = e.data as any;
      return d.categories?.includes(cat);
    }).map(e => ({ value: (e.data as any).value, label: (e.data as any).label }));
    if (fromDb.length > 0) return fromDb;
    return getFrameTypesForCategory(cat).map(ft => ({ value: ft.value, label: ft.label }));
  };

  const iguTypeOptions: SelectOption[] = [
    { value: "EnergySaver", label: "EnergySaver" },
    { value: "LightBridge", label: "LightBridge" },
    { value: "VLamThermotech", label: "VLam Thermotech" },
  ];

  const glassComboOptions = (iguType: string): string[] => {
    const fromDb = libGlass.filter(e => (e.data as any).iguType === iguType).map(e => (e.data as any).combo as string);
    return fromDb.length > 0 ? fromDb : getGlassCombos(iguType);
  };

  const glassThicknessOptions = (iguType: string, combo: string): string[] => {
    const entry = libGlass.find(e => (e.data as any).iguType === iguType && (e.data as any).combo === combo);
    if (entry) return Object.keys((entry.data as any).prices || {});
    return getAvailableThicknesses(iguType, combo);
  };

  const linerOptions: SelectOption[] = libLiners.length > 0
    ? libLiners.map(e => ({ value: (e.data as any).value, label: (e.data as any).label }))
    : LINER_TYPES.map(lt => ({ value: lt.value, label: lt.label }));

  const handleOptions = (cat = "windows-standard"): SelectOption[] => {
    const handles = cat.includes("door") ? libDoorHandles : libWindowHandles;
    if (handles.length > 0) return handles.map(e => ({ value: (e.data as any).value, label: (e.data as any).label }));
    return getHandlesForCategory(cat).map(h => ({ value: h.value, label: h.label }));
  };

  const lockOptions: SelectOption[] = (() => {
    if (libEntranceDoorLocks.length > 0) {
      const seen = new Set<string>();
      return libEntranceDoorLocks
        .map(e => ({ value: (e.data as any).value as string, label: (e.data as any).label as string }))
        .filter(o => { if (seen.has(o.value)) return false; seen.add(o.value); return true; });
    }
    const fallback = LOCK_CATEGORIES[0]?.defaults || [];
    return fallback.map(l => ({ value: l.value, label: l.label }));
  })();

  const windZoneOptions: SelectOption[] = WIND_ZONES.map(wz => ({ value: wz, label: wz }));

  return {
    frameTypeOptions,
    iguTypeOptions,
    glassComboOptions,
    glassThicknessOptions,
    linerOptions,
    handleOptions,
    lockOptions,
    windZoneOptions,
  };
}
