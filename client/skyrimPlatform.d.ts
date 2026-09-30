/**
 * Ambient type definitions for Skyrim Platform and SkyMP client environment.
 */

declare module 'skyrimPlatform' {
  export interface Form {
    getFormId(): number;
    getName(): string;
    hasKeyword(keyword: Form): boolean;
  }

  export interface Actor extends Form {
    getLevel(): number;
    getHealth(): number;
    getMaxHealth(): number;
    getMagicka(): number;
    getMaxMagicka(): number;
    getStamina(): number;
    getMaxStamina(): number;
    getBaseObject(): Form;
    getPositionX(): number;
    getPositionY(): number;
    getPositionZ(): number;
    getParentCell(): Form | null;
    hasPerk(perk: Form): boolean;
    addPerk(perk: Form): void;
    removePerk(perk: Form): void;
    getActorValue(actorValue: string): number;
    setActorValue(actorValue: string, value: number): void;
    getRace(): Form;
    getActorBase(): Form;
    kill(killer?: Actor): void;
    isInCombat(): boolean;
  }

  export const Actor: {
    from(form: Form | null): Actor | null;
  };

  export interface DeathEvent {
    actorDying: Form;
    actorKiller: Form;
  }

  export interface ButtonEvent {
    code: number;
    isDown: boolean;
    isRepeating: boolean;
  }

  export interface GameNamespace {
    getPlayer(): Actor;
    getFormFromFile(formId: number, pluginName: string): Form | null;
    getFormEx(formId: number): Form | null;
  }

  export interface DebugNamespace {
    messageBox(text: string): void;
    notification(text: string): void;
  }

  export interface InputNamespace {
    isKeyPressed(keyCode: number): boolean;
    tapKey(keyCode: number): void;
  }

  export interface UiNamespace {
    isMenuOpen(menuName: string): boolean;
  }

  export const Game: GameNamespace;
  export const Debug: DebugNamespace;
  export const Input: InputNamespace;
  export const Ui: UiNamespace;

  export function on(eventName: 'deathStart', callback: (event: DeathEvent) => void): void;
  export function on(eventName: 'buttonEvent', callback: (event: ButtonEvent) => void): void;
  export function on(eventName: string, callback: (...args: any[]) => void): void;
  export function once(eventName: string, callback: (...args: any[]) => void): void;
  export function printConsole(...args: any[]): void;
}

// SkyMP ambient types
declare namespace mp {
  export interface Events {
    add(eventName: string, callback: (...args: any[]) => void): void;
    callRemote(eventName: string, ...args: any[]): void;
  }
  export const events: Events;
  export function get(key: string): any;
  export function set(key: string, value: any): void;
}
