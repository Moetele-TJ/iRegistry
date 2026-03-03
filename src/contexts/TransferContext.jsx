// src/contexts/TransferContext.jsx

import { createContext, useContext } from "react";
import { usePendingTransfers } from "../hooks/usePendingTransfers";
import { useAuth } from "../contexts/AuthContext";

const TransferContext = createContext(null);

export function TransferProvider({ children }) {
  const { user } = useAuth();
  const transfers = usePendingTransfers();

  // If not logged in → no fetch needed
  if (!user) {
    return (
      <TransferContext.Provider
        value={{ data: [], count: 0, loading: false, refresh: () => {} }}
      >
        {children}
      </TransferContext.Provider>
    );
  }

  // If logged in → provide real data
  return (
    <TransferContext.Provider
      value={{
        ...transfers,
      }}
    >
      {children}
    </TransferContext.Provider>
  );
}

export function useTransfers() {
  return useContext(TransferContext);
}