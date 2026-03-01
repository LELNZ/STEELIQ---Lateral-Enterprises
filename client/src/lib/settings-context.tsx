import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type QuoteListPosition = "bottom" | "right";

interface AppSettings {
  showLegendDefault: boolean;
  quoteListPosition: QuoteListPosition;
  usdToNzdRate: number;
}

interface SettingsContextValue extends AppSettings {
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

const STORAGE_KEY = "proquote-settings";

const defaults: AppSettings = {
  showLegendDefault: true,
  quoteListPosition: "bottom",
  usdToNzdRate: 1.7,
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {}
  return { ...defaults };
}

const SettingsContext = createContext<SettingsContextValue>({
  ...defaults,
  updateSetting: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <SettingsContext.Provider value={{ ...settings, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
