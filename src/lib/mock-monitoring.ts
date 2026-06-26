/** Deterministic default values for all monitoring configuration sections. */

export const MONITORING_DEFAULTS = {
  idle: {
    thresholdMins: 5,
    pauseTimerOnIdle: true,
    countIdleAsBreak: false,
  },
  screenshots: {
    frequencyMins: 10,
    blurByDefault: false,
    captureOnIdle: false,
    retentionDays: 30,
  },
  productivity: {
    productiveThreshold: 70,
    lowActivityThreshold: 40,
  },
  workHours: {
    expectedHoursPerDay: 8,
    overtimeAlertThreshold: 9,
  },
  alertThresholds: {
    longInactivityMins: 60,
    productivityDropPercent: 20,
    burnoutHoursPerDay: 10,
  },
  silentMonitoring: false,
} as const

export type MonitoringSettings = {
  idle: { thresholdMins: number; pauseTimerOnIdle: boolean; countIdleAsBreak: boolean }
  screenshots: {
    frequencyMins: number
    blurByDefault: boolean
    captureOnIdle: boolean
    retentionDays: number
  }
  productivity: { productiveThreshold: number; lowActivityThreshold: number }
  workHours: { expectedHoursPerDay: number; overtimeAlertThreshold: number }
  alertThresholds: {
    longInactivityMins: number
    productivityDropPercent: number
    burnoutHoursPerDay: number
  }
  silentMonitoring: boolean
}
