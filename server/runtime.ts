import type { NativeCombatApi } from './combatProfileAdapter';

export interface ClassRuntime extends Partial<NativeCombatApi> {
  get(actorId: number, property: string): unknown;
  set(actorId: number, property: string, value: string): void;
  getServerSettings(): { aetheriusCombatSettings?: { enabled?: boolean; mode?: string } };
  makeProperty?(name: string, options: Record<string, unknown>): void;
}

declare const mp: ClassRuntime | undefined;
let configured: ClassRuntime | undefined;
export function configureClassRuntime(runtime: ClassRuntime): void {
  if (!runtime || typeof runtime.get !== 'function' || typeof runtime.set !== 'function' || typeof runtime.getServerSettings !== 'function') throw new Error('ClassSystem requires authoritative persistence/settings API');
  configured = runtime;
}
export function getClassRuntime(): ClassRuntime | undefined { return configured ?? (typeof mp === 'undefined' ? undefined : mp); }
