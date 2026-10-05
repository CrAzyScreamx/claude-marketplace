export type Limit = { kind: string; percentUsed: number }

declare module 'claude-code' {
  interface PluginState {
    'usage-alert': { limits: Limit[] }
  }
}
