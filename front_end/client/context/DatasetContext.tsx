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

const defaultContext: DatasetContextValue = {
  dataset: "yahoo",
  setDataset: () => {},
  company: "AAPL",
  setCompany: () => {},
};

const DatasetContext = createContext<DatasetContextValue>(defaultContext);

export const DatasetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dataset, setDataset] = useState<DatasetKey>("yahoo");
  const [company, setCompany] = useState<string>("AAPL");
  return <DatasetContext.Provider value={{ dataset, setDataset, company, setCompany }}>{children}</DatasetContext.Provider>;
};

export function useDataset() {
  const ctx = useContext(DatasetContext);
  // If the hook is used outside the provider, return the default context but warn in dev
  if (ctx === defaultContext) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("useDataset used outside DatasetProvider — using fallback defaults.");
    }
  }
  return ctx;
}
