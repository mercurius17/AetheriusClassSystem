/**
 * Tipos e interfaces fundamentais para o Sistema de Classes, Leveling, Grupos e Raid.
 */

export type Archetype = 'CONJURADORES' | 'GUERREIROS' | 'ESPECIALISTAS';

export interface StageProgression {
  level: number;
  stageNumber: number;
  perks: string[];
  skills: string;
  attributePoints: number;
}

export interface ClassDefinition {
  id: string;
  key: string;
  name: string;
  fullName: string;
  archetype: Archetype;
  requiresWinterholdStudent: boolean;
  description: string;
  stages: StageProgression[];
  authorizedSpells: Record<string, string[]>;
  allSpellsList?: Array<{ name: string; tier: string; description: string }>;
  spellsRPNotice: string;
}

export interface PerkDescription {
  name: string;
  namePt: string;
  descriptionPt: string;
  originalDesc?: string;
}

export interface SpellDescription {
  name: string;
  namePt: string;
  tier: string;
  descriptionPt: string;
}

export interface PerkMapping {
  name: string;
  localId: string;
  candidatePlugins: string[];
  editorIdAliases: string[];
}

export type ResolutionStrategy = 'CACHE' | 'LOCAL_ID_PLUGIN' | 'EDITOR_ID' | 'SEMANTIC_NAME' | 'CONFIG_OVERRIDE' | 'FALLBACK_MOCK' | 'UNRESOLVED';

export interface ResolvedPerk {
  name: string;
  namePt: string;
  descriptionPt: string;
  resolvedFormId: number;
  hexFormId: string;
  pluginFound: string | null;
  strategyUsed: ResolutionStrategy;
  isResolved: boolean;
}

export interface PlayerClassState {
  combatRevision?: number;
  playerId: number;
  playerName: string;
  classId: string | null;
  className: string | null;
  level: number;
  currentXp: number;
  nextLevelXp: number;
  totalXpAccumulated: number;
  unspentAttributePoints: number;
  allocatedHealth: number;
  allocatedMagicka: number;
  allocatedStamina: number;
  unlockedPerks: string[];
  unlockedPerksData?: ResolvedPerk[];
  hasWinterholdKeyword: boolean;
  hasResetTicket: boolean;
  partyId: string | null;
  isRaid: boolean;
  // Sistema de Cansaço Diário (Máx 20% do nível a partir do Nv. 15, reset diário às 06h BRT)
  dailyCycleKey?: string;
  dailyXpGained?: number;
  dailyXpCap?: number | null;
  isFatigued?: boolean;
  // Atributos raciais do Aetherius e habilidades desbloqueadas por estágio
  playerRace?: string;
  baseAttributes?: { health: number; magicka: number; stamina: number };
  unlockedSkills?: Record<string, number>;
}

export interface PartyMember {
  id: number;
  name: string;
  classId: string | null;
  className: string;
  level: number;
  health: number;
  maxHealth: number;
  magicka: number;
  maxMagicka: number;
  stamina: number;
  maxStamina: number;
  isLeader: boolean;
  subgroupId: number; // 1 a 4 para Raids
  pos: [number, number, number];
  cellOrWorldDesc: string;
  isOnline: boolean;
}

export interface PartyState {
  partyId: string;
  leaderId: number;
  isRaid: boolean;
  members: PartyMember[];
  maxMembers: number; // 8 para normal, 20 para raid
}

export interface CombatKillEvent {
  killerId: number;
  victimId?: number;
  victimName: string;
  victimLevel: number;
  victimBaseXp: number;
  isDragonPriest: boolean;
  isDragon: boolean;
}

export interface LevelProgressionEntry {
  levelFrom: number;
  levelTo: number;
  pace: string;
  xpRequired: number;
  totalAccumulated: number;
}
