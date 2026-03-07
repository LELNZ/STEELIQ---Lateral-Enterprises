import { createContext, useContext, useRef, useCallback, type ReactNode } from "react";

/**
 * Guard callback return values:
 * - false: safe to navigate, no unsaved work
 * - true: blocked, has unsaved changes (uses default confirmation message)
 * - string: blocked, has unsaved changes (uses the returned string as confirmation message)
 */
type GuardCallback = () => boolean | string;

interface NavigationGuardContextValue {
  registerGuard: (callback: GuardCallback) => void;
  unregisterGuard: () => void;
  checkGuard: () => { blocked: boolean; message?: string };
}

const NavigationGuardContext = createContext<NavigationGuardContextValue>({
  registerGuard: () => {},
  unregisterGuard: () => {},
  checkGuard: () => ({ blocked: false }),
});

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const guardRef = useRef<GuardCallback | null>(null);

  const registerGuard = useCallback((callback: GuardCallback) => {
    guardRef.current = callback;
  }, []);

  const unregisterGuard = useCallback(() => {
    guardRef.current = null;
  }, []);

  const checkGuard = useCallback((): { blocked: boolean; message?: string } => {
    if (!guardRef.current) return { blocked: false };
    const result = guardRef.current();
    if (result === false) return { blocked: false };
    if (result === true) return { blocked: true };
    return { blocked: true, message: result };
  }, []);

  return (
    <NavigationGuardContext.Provider value={{ registerGuard, unregisterGuard, checkGuard }}>
      {children}
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard() {
  return useContext(NavigationGuardContext);
}
