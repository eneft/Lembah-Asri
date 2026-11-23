/** Optional manual layout for keyboard/mouse or touchscreen PCs. */
export type ControlPreference = 'auto' | 'desktop' | 'tablet';
export type ResolvedControlMode = 'desktop' | 'tablet';
export const CONTROL_MODE_KEY = 'lembah-asri:control-mode:v1';

export function parseControlPreference(value: string | null): ControlPreference {
  return value === 'desktop' || value === 'tablet' ? value : 'auto';
}

export function resolveControlMode(
  preference: ControlPreference,
  coarsePointer: boolean,
  compactScreen: boolean
): ResolvedControlMode {
  if (preference !== 'auto') return preference;
  return coarsePointer || compactScreen ? 'tablet' : 'desktop';
}
