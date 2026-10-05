export type Handoff = {
  sessionId: string
  root: string
  writtenAt: number
  summary: string
}

// none: working or not idle long enough; warned: the 5-minute grace is running;
// saving: the summary is being written; saved: written for this idle stretch.
export type Stage = 'none' | 'warned' | 'saving' | 'saved'

declare module 'claude-code' {
  interface PluginState {
    'idle-handoff': {
      idleSince: number | null
      stage: Stage
      offer: Handoff | null
      // A main-thread turn finished since the last summary was saved.
      isDirty: boolean
    }
  }
}
