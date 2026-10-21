import { createContext, useContext, type ReactNode } from 'react';
import { brand } from './brand';
import type { BrandConfig } from './schema';

const BrandContext = createContext<BrandConfig>(brand);

export function BrandProvider({ children }: { children: ReactNode }) {
  return (
    <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>
  );
}

export function useBrand(): BrandConfig {
  return useContext(BrandContext);
}
