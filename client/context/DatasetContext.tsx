import React, { createContext, useContext, useState } from "react";

type DatasetKey =
  | "yahoo"
  | "kaggle_crypto"
  | "fred"
  | "worldbank"
  | "alpha_vantage";

interface DatasetContextValue {
  dataset: DatasetKey;
  setDataset: (d: DatasetKey) => void;
  company: string;
  setCompany: (c: string) => void;
}

const DatasetContext = createContext<DatasetContextValue | undefined>(undefined);

export const DatasetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dataset, setDataset] = useState<DatasetKey>("yahoo");
  const [company, setCompany] = useState<string>("AAPL");
  return <DatasetContext.Provider value={{ dataset, setDataset, company, setCompany }}>{children}</DatasetContext.Provider>;
};

export function useDataset() {
  const ctx = useContext(DatasetContext);
  if (!ctx) throw new Error("useDataset must be used within DatasetProvider");
  return ctx;
}
