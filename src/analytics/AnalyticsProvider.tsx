'use client';

import React, { createContext, useContext, useMemo } from 'react';
import type { AnalyticsTrack } from './events';
import { track } from './client';

const noopTrack: AnalyticsTrack = () => undefined;

const AnalyticsContext = createContext<AnalyticsTrack>(noopTrack);

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(() => track, []);
  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics(): AnalyticsTrack {
  return useContext(AnalyticsContext);
}
