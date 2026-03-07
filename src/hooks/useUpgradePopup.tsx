import { createContext, useContext, useState, useCallback } from "react";

interface UpgradePopupContextType {
  open: boolean;
  triggerUpgrade: (reason?: string) => void;
  close: () => void;
  reason: string;
}

const UpgradePopupContext = createContext<UpgradePopupContextType>({
  open: false,
  triggerUpgrade: () => {},
  close: () => {},
  reason: "",
});

export const useUpgradePopup = () => useContext(UpgradePopupContext);

export const UpgradePopupProvider = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const triggerUpgrade = useCallback((r?: string) => {
    setReason(r || "");
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  return (
    <UpgradePopupContext.Provider value={{ open, triggerUpgrade, close, reason }}>
      {children}
    </UpgradePopupContext.Provider>
  );
};
