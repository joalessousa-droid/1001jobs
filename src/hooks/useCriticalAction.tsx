// Hook imperativo para exigir confirmação crítica antes de uma ação sensível.
import { createContext, useCallback, useContext, useRef, useState, ReactNode } from "react";
import { CriticalActionDialog, CriticalContext } from "@/components/security/CriticalActionDialog";

interface Options { context: CriticalContext; requireFace?: boolean }
type Resolver = (ok: boolean) => void;

interface Ctx { require: (opts: Options) => Promise<boolean> }
const CriticalCtx = createContext<Ctx | null>(null);

export function CriticalActionProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<Options>({ context: "withdrawal" });
  const resolverRef = useRef<Resolver | null>(null);

  const require = useCallback((o: Options) => {
    setOpts(o); setOpen(true);
    return new Promise<boolean>((resolve) => { resolverRef.current = resolve; });
  }, []);

  return (
    <CriticalCtx.Provider value={{ require }}>
      {children}
      <CriticalActionDialog
        open={open}
        context={opts.context}
        requireFace={opts.requireFace}
        onResolved={(ok) => { setOpen(false); resolverRef.current?.(ok); resolverRef.current = null; }}
      />
    </CriticalCtx.Provider>
  );
}

export function useCriticalAction() {
  const ctx = useContext(CriticalCtx);
  if (!ctx) throw new Error("useCriticalAction must be used inside CriticalActionProvider");
  return ctx.require;
}
