import { PlayerClassState } from '../../shared/types';
import { getXpRequiredForNextLevel, getDailyCycleKey, calculateDailyXpCap } from '../../shared/levelingMath';
import { getRaceBaseAttributes } from '../../shared/raceData';
import { getClassById } from '../../shared/classesData';
import { resolveSkillsForClassAndLevel } from '../../shared/skillResolver';
import { publishCombatProfile } from '../combatProfileAdapter';
import combatCatalog from '../../config/verified-perks.json';

import { getClassRuntime } from '../runtime';

// Progression is JSON data. Keep this usable in embedded gamemode runtimes too.
const cloneState = (state: PlayerClassState): PlayerClassState => JSON.parse(JSON.stringify(state));

export class PlayerRepository {
  private static instance: PlayerRepository;
  private memoryStore: Map<number, PlayerClassState> = new Map();

  public static getInstance(): PlayerRepository {
    if (!PlayerRepository.instance) {
      PlayerRepository.instance = new PlayerRepository();
    }
    return PlayerRepository.instance;
  }

  public getPlayerState(playerId: number, playerName: string = `Player_${playerId}`): PlayerClassState {
    const mp = getClassRuntime();
    // 1. Tenta recuperar da memória
    if (this.memoryStore.has(playerId)) {
      const state = cloneState(this.memoryStore.get(playerId)!);
      this.refreshDailyCycle(state);
      return state;
    }

    // 2. Tenta recuperar do SkyMP mp.get se disponível
    let loadedState: PlayerClassState | undefined;
    if (typeof mp !== 'undefined' && mp.get) {
      try {
        const raw = mp.get(playerId, 'playerClassData');
        if (raw) {
          const parsed: PlayerClassState = typeof raw === 'string' ? JSON.parse(raw) : raw;
          this.refreshDailyCycle(parsed);
          loadedState = parsed;
        }
      } catch (err) {
        console.error(`[PlayerRepository] Erro ao carregar dados do jogador ${playerId}:`, err);
      }
    }

    // A combat compatibility error must propagate, never erase persisted progression
    // by falling through to the new-character default after a successful load.
    if (loadedState) {
      this.publishCombat(loadedState);
      this.memoryStore.set(playerId, cloneState(loadedState));
      return loadedState;
    }

    // 3. Cria estado inicial para novo jogador
    const defaultState: PlayerClassState = {
      playerId,
      playerName,
      classId: null,
      className: null,
      level: 1,
      currentXp: 0,
      nextLevelXp: getXpRequiredForNextLevel(1),
      totalXpAccumulated: 0,
      unspentAttributePoints: 0,
      allocatedHealth: 0,
      allocatedMagicka: 0,
      allocatedStamina: 0,
      unlockedPerks: [],
      hasWinterholdKeyword: false,
      hasResetTicket: false,
      partyId: null,
      isRaid: false,
      dailyCycleKey: getDailyCycleKey(),
      dailyXpGained: 0,
      dailyXpCap: calculateDailyXpCap(1),
      isFatigued: false,
      playerRace: undefined,
      baseAttributes: getRaceBaseAttributes(),
      unlockedSkills: {}
    };

    this.savePlayerState(defaultState);
    return defaultState;
  }

  public refreshDailyCycle(state: PlayerClassState): void {
    const currentCycle = getDailyCycleKey();
    if (state.dailyCycleKey !== currentCycle) {
      state.dailyCycleKey = currentCycle;
      state.dailyXpGained = 0;
      state.dailyXpCap = calculateDailyXpCap(state.level);
      state.isFatigued = false;
    } else if (state.dailyXpCap === undefined) {
      state.dailyXpCap = calculateDailyXpCap(state.level);
    }

    if (state.level < 15) {
      state.isFatigued = false;
      state.dailyXpCap = null;
    }
  }

  public savePlayerState(state: PlayerClassState): void {
    const mp = getClassRuntime();
    this.publishCombat(state);
    this.memoryStore.set(state.playerId, cloneState(state));

    if (typeof mp !== 'undefined' && mp.set) {
      try {
        mp.set(state.playerId, 'playerClassData', JSON.stringify(state));
      } catch (err) {
        console.error(`[PlayerRepository] Erro ao salvar dados do jogador ${state.playerId}:`, err);
      }
    }
  }

  public clearMemory(): void {
    this.memoryStore.clear();
  }

  private publishCombat(state: PlayerClassState): void {
    const mp = getClassRuntime();
    if (typeof mp === 'undefined' || !mp.getServerSettings) return;
    const settings = mp.getServerSettings().aetheriusCombatSettings;
    if (!settings?.enabled || settings.mode !== 'aetherius') return;
    if (!mp.applyActorCombatProfile || !mp.getActorCombatProfile) throw new Error('Missing native CombatProfile API');
    const cls = state.classId ? getClassById(state.classId) : null;
    if (state.classId && !cls) throw new Error('Unknown persisted class');
    const skills = cls ? resolveSkillsForClassAndLevel(cls, state.level) : {};
    const profile = publishCombatProfile({
      getActorCombatProfile: id => mp.getActorCombatProfile!(id),
      applyActorCombatProfile: (id, json) => mp.applyActorCombatProfile!(id, json)
    }, state, skills, combatCatalog);
    state.unlockedSkills = profile.skills;
  }
}
