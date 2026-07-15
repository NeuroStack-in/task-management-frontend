import { create } from "zustand"
import { persist } from "zustand/middleware"

export type FeatureKey =
  | "time-tracking"
  | "activity-monitoring"
  | "screenshots"
  | "ai"
  | "billing"
  | "reports"
  | "integrations"
  | "communication"
  | "approvals"
  | "desktop-agents"

const DEFAULTS: Record<FeatureKey, boolean> = {
  "time-tracking": true,
  "activity-monitoring": true,
  screenshots: true,
  ai: true,
  billing: true,
  reports: true,
  integrations: true,
  communication: true,
  approvals: true,
  "desktop-agents": false,
}

interface FeaturesState {
  features: Record<FeatureKey, boolean>
  toggle: (key: FeatureKey) => void
  setFeatures: (features: Record<FeatureKey, boolean>) => void
  reset: () => void
}

export const useFeaturesStore = create<FeaturesState>()(
  persist(
    (set) => ({
      features: { ...DEFAULTS },
      toggle: (key) =>
        set((s) => ({ features: { ...s.features, [key]: !s.features[key] } })),
      setFeatures: (features) => set({ features }),
      reset: () => set({ features: { ...DEFAULTS } }),
    }),
    { name: "wp-features", version: 1 },
  ),
)
