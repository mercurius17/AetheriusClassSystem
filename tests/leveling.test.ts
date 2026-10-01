import {
  calculateCombatXp,
  calculateDeltaModifier,
  calculatePartyModifier,
  getXpRequiredForNextLevel,
  getTotalXpAccumulatedForLevel,
  LEVEL_PROGRESSION_TABLE,
  MAX_CLASS_LEVEL,
  ATTRIBUTE_POINTS_PER_LEVEL,
  TOTAL_DISTRIBUTED_ATTRIBUTE_POINTS,
  calculateDailyXpCap
} from '../shared/levelingMath';
import { LevelingSystem } from '../server/levelingSystem';
import { PlayerRepository } from '../server/storage/playerRepository';

describe('Sistema de Leveling e Fórmulas Matemáticas de XP', () => {
  test('Deve conter todos os 39 degraus de progressão até o nível 40', () => {
    expect(LEVEL_PROGRESSION_TABLE.length).toBe(39);
    expect(LEVEL_PROGRESSION_TABLE[0].levelFrom).toBe(1);
    expect(LEVEL_PROGRESSION_TABLE[0].levelTo).toBe(2);
    expect(LEVEL_PROGRESSION_TABLE[0].xpRequired).toBe(200);

    // Nível 39 -> 40
    const last = LEVEL_PROGRESSION_TABLE[38];
    expect(last.levelFrom).toBe(39);
    expect(last.levelTo).toBe(40);
    expect(last.xpRequired).toBe(198500);
    expect(last.totalAccumulated).toBe(1848000);
  });

  test('Deve aplicar o cansaço ao cruzar do nível 14 para o 15 no mesmo prêmio de XP', () => {
    const playerRepo = PlayerRepository.getInstance();
    const levelingSystem = LevelingSystem.getInstance();
    const state = playerRepo.getPlayerState(9191);
    state.classId = 'arqueiro';
    state.className = 'Arqueiro';
    state.level = 14;
    state.currentXp = 9000;
    state.nextLevelXp = getXpRequiredForNextLevel(14);
    state.dailyXpGained = 0;

    const result = levelingSystem.addExperience(state, 100_000);

    expect(result.newLevel).toBe(15);
    expect(result.xpAwarded).toBe(100 + calculateDailyXpCap(15)!);
    expect(state.isFatigued).toBe(true);
  });

  test('Deve rejeitar XP inválida sem corromper o estado', () => {
    const state = PlayerRepository.getInstance().getPlayerState(9292);
    state.classId = 'arqueiro';
    const before = { ...state };

    expect(LevelingSystem.getInstance().addExperience(state, Number.NaN).xpAwarded).toBe(0);
    expect(LevelingSystem.getInstance().addExperience(state, -100).xpAwarded).toBe(0);
    expect(state.currentXp).toBe(before.currentXp);
    expect(state.totalXpAccumulated).toBe(before.totalXpAccumulated);
  });

  test('Deve ignorar XP e classificação de chefe forjadas pelo cliente', () => {
    const state = PlayerRepository.getInstance().getPlayerState(9393);
    state.classId = 'arqueiro';

    const result = LevelingSystem.getInstance().processCombatKill({
      killerId: 9393,
      victimId: 123,
      victimName: 'Bandit',
      victimLevel: 1,
      victimBaseXp: 10_000,
      isDragon: true,
      isDragonPriest: true
    });

    expect(result.awardedPlayers[0].xpAwarded).toBe(10);
  });

  test('Deve validar a quantidade total de pontos de atributos (585 pontos)', () => {
    expect(TOTAL_DISTRIBUTED_ATTRIBUTE_POINTS).toBe(585);
    expect(ATTRIBUTE_POINTS_PER_LEVEL).toBe(15);
    expect((MAX_CLASS_LEVEL - 1) * ATTRIBUTE_POINTS_PER_LEVEL).toBe(585);
  });

  test('Deve calcular o Modificador Delta corretamente conforme a Seção 3', () => {
    expect(calculateDeltaModifier(1, 25)).toBe(0.0); // Delta = -24 (<= -20)
    expect(calculateDeltaModifier(5, 20)).toBe(0.25); // Delta = -15 (-19 a -11)
    expect(calculateDeltaModifier(10, 18)).toBe(0.50); // Delta = -8 (-10 a -6)
    expect(calculateDeltaModifier(15, 18)).toBe(0.75); // Delta = -3 (-5 a -1)
    expect(calculateDeltaModifier(20, 20)).toBe(1.00); // Delta = 0
    expect(calculateDeltaModifier(23, 20)).toBe(1.10); // Delta = +3 (+1 a +5)
    expect(calculateDeltaModifier(28, 20)).toBe(1.25); // Delta = +8 (+6 a +10)
    expect(calculateDeltaModifier(35, 20)).toBe(1.50); // Delta = +15 (>= +11)
  });

  test('Deve calcular o Modificador de Party e Raid conforme Seções 2 e 7', () => {
    // Solo
    expect(calculatePartyModifier(1)).toBe(1.0);

    // Party Normal (2 a 8 membros): -5% por membro
    expect(calculatePartyModifier(2)).toBe(0.90);
    expect(calculatePartyModifier(3)).toBe(0.85);
    expect(calculatePartyModifier(4)).toBe(0.80);
    expect(calculatePartyModifier(5)).toBe(0.75);
    expect(calculatePartyModifier(6)).toBe(0.70);
    expect(calculatePartyModifier(7)).toBe(0.65);
    expect(calculatePartyModifier(8)).toBe(0.60);

    // Raid Party (8 a 20 membros)
    expect(calculatePartyModifier(8, true)).toBe(0.600);
    expect(calculatePartyModifier(9, true)).toBe(0.583);
    expect(calculatePartyModifier(10, true)).toBe(0.567);
    expect(calculatePartyModifier(14, true)).toBe(0.500);
    expect(calculatePartyModifier(20, true)).toBe(0.400);
  });

  test('Deve calcular o XP de combate para Inimigos Regulares (Nível 1 a 20)', () => {
    // Bandido Nv 1 (Base 10), Jogador Nv 1, Solo
    // XP = 10 * (1 + 0 * 0.20) * 1.0 * 1.0 = 10.0
    const xpBandit1 = calculateCombatXp(10, 1, 1, 1);
    expect(xpBandit1).toBe(10.0);

    // Bandido Nv 5 (Base 10), Jogador Nv 5, Solo
    // XP = 10 * (1 + 4 * 0.20) * 1.0 * 1.0 = 10 * 1.8 = 18.0
    const xpBandit5 = calculateCombatXp(10, 5, 5, 1);
    expect(xpBandit5).toBe(18.0);

    // Draugr Nv 20 (Base 18), Jogador Nv 20, Solo
    // XP = 18 * (1 + 19 * 0.20) * 1.0 * 1.0 = 18 * 4.8 = 86.4
    const xpDraugr20 = calculateCombatXp(18, 20, 20, 1);
    expect(xpDraugr20).toBe(86.4);
  });

  test('Deve calcular o XP de combate no Soft Cap (Nível 21 a 40)', () => {
    // Draugr Nv 25 (Base 18), Jogador Nv 25, Solo
    // XP = 18 * (4.80 + 5 * 0.05) * 1.0 * 1.0 = 18 * 5.05 = 90.9
    const xpDraugr25 = calculateCombatXp(18, 25, 25, 1);
    expect(xpDraugr25).toBe(90.9);

    // Draugr Nv 40 (Base 18), Jogador Nv 40, Solo
    // XP = 18 * (4.80 + 20 * 0.05) * 1.0 * 1.0 = 18 * 5.80 = 104.4
    const xpDraugr40 = calculateCombatXp(18, 40, 40, 1);
    expect(xpDraugr40).toBe(104.4);

    // Draugr Nv 40 em Raid de 8 membros (60% de 104.4 = 62.64 -> 62.6)
    const xpDraugr40Raid8 = calculateCombatXp(18, 40, 40, 8, true);
    expect(xpDraugr40Raid8).toBe(62.6);
  });

  test('Deve conceder XP fixa para Chefes Épicos independente do nível do ator', () => {
    // Dragon Priest (500 fixo) Solo
    expect(calculateCombatXp(0, 50, 20, 1, false, true, false)).toBe(500.0);

    // Dragon Priest em Grupo de 6 (-30% = 350 XP)
    expect(calculateCombatXp(0, 50, 20, 6, false, true, false)).toBe(350.0);

    // Dragão (1000 fixo) Solo
    expect(calculateCombatXp(0, 50, 20, 1, false, false, true)).toBe(1000.0);

    // Dragão em Raid de 10 membros (56.7% = 567 XP)
    expect(calculateCombatXp(0, 50, 20, 10, true, false, true)).toBe(567.0);

    // Dragão em Raid de 20 membros (40.0% = 400 XP)
    expect(calculateCombatXp(0, 50, 20, 20, true, false, true)).toBe(400.0);
  });

  describe('Sistema de Cansaço Diário (Máx 20% por Nível e Reset às 06h BRT)', () => {
    const {
      calculateDailyXpCap,
      getDailyCycleKey,
      getNextDailyResetTimestamp,
      DAILY_XP_CAP_PERCENTAGE,
      FATIGUE_SYSTEM_MIN_LEVEL,
      isFatigueSystemActive
    } = require('../shared/levelingMath');
    const { LevelingSystem } = require('../server/levelingSystem');
    const { PlayerRepository } = require('../server/storage/playerRepository');

    test('Deve validar que o cansaço diário NÃO existe até o nível 15 em todas as classes', () => {
      expect(DAILY_XP_CAP_PERCENTAGE).toBe(0.20);
      expect(FATIGUE_SYSTEM_MIN_LEVEL).toBe(15);

      // Níveis 1 a 14: cansaço desativado, calculateDailyXpCap retorna null
      for (let lvl = 1; lvl < 15; lvl++) {
        expect(isFatigueSystemActive(lvl)).toBe(false);
        expect(calculateDailyXpCap(lvl)).toBeNull();
      }

      // A partir do nível 15: cansaço ativo com limite de 20%
      expect(isFatigueSystemActive(15)).toBe(true);
      expect(calculateDailyXpCap(15)).toBe(Math.floor(10800 * 0.20)); // 2.160 XP

      // Exemplo oficial do usuário: Nível 26 -> 50.000 XP requerida -> 10.000 XP limite diário
      expect(isFatigueSystemActive(26)).toBe(true);
      expect(calculateDailyXpCap(26)).toBe(10000);

      // Nível 39: 198.500 XP requerida -> 39.700 XP limite diário
      expect(calculateDailyXpCap(39)).toBe(39700);
    });

    test('Deve permitir ganho irrestrito e ilimitado de XP sem cansaço nos níveis 1 a 14', () => {
      const levelingSystem = LevelingSystem.getInstance();
      const playerRepo = PlayerRepository.getInstance();

      const playerId = 7777;
      const playerState = playerRepo.getPlayerState(playerId);
      playerState.classId = 'arqueiro';
      playerState.level = 10;
      playerState.nextLevelXp = 4100;
      playerState.currentXp = 0;
      playerState.dailyCycleKey = getDailyCycleKey();
      playerState.dailyXpGained = 0;
      playerState.dailyXpCap = null;
      playerState.isFatigued = false;
      playerRepo.savePlayerState(playerState);

      // Adiciona 20.000 XP (muito mais que 20% do nível 10, que seria 820 XP se houvesse cansaço)
      const res = levelingSystem.addExperience(playerState, 20000);
      expect(res.xpAwarded).toBe(20000);
      expect(playerState.isFatigued).toBe(false);
      expect(playerState.level).toBeGreaterThan(10);
    });

    test('Deve validar o ciclo diário determinístico com virada às 06:00 BRT (09:00 UTC)', () => {
      // 05 de Setembro de 2026 às 05:59 BRT (08:59 UTC) -> Pertence ao ciclo de 2026-09-04
      const tBeforeReset = new Date('2026-09-05T08:59:00Z').getTime();
      expect(getDailyCycleKey(tBeforeReset)).toBe('2026-09-04');

      // 05 de Setembro de 2026 às 06:00 BRT (09:00 UTC) -> Virada para o ciclo de 2026-09-05
      const tAtReset = new Date('2026-09-05T09:00:00Z').getTime();
      expect(getDailyCycleKey(tAtReset)).toBe('2026-09-05');

      // 05 de Setembro de 2026 às 23:59 BRT (02:59 UTC de 06/09) -> Ainda no ciclo de 2026-09-05
      const tNight = new Date('2026-09-06T02:59:00Z').getTime();
      expect(getDailyCycleKey(tNight)).toBe('2026-09-05');

      // 06 de Setembro de 2026 às 06:00 BRT (09:00 UTC de 06/09) -> Virada para o ciclo de 2026-09-06
      const tNextReset = new Date('2026-09-06T09:00:00Z').getTime();
      expect(getDailyCycleKey(tNextReset)).toBe('2026-09-06');
    });

    test('Deve limitar o ganho de XP em exatamente 20% e bloquear novos ganhos ao atingir a trava', () => {
      const levelingSystem = LevelingSystem.getInstance();
      const playerRepo = PlayerRepository.getInstance();

      const playerId = 8888;
      const playerState = playerRepo.getPlayerState(playerId);
      playerState.classId = 'guerreiro';
      playerState.level = 26; // Nível 26: precisa de 50.000 XP -> teto diário de 10.000 XP
      playerState.nextLevelXp = 50000;
      playerState.currentXp = 0;
      playerState.dailyCycleKey = getDailyCycleKey();
      playerState.dailyXpGained = 0;
      playerState.dailyXpCap = 10000;
      playerState.isFatigued = false;
      playerRepo.savePlayerState(playerState);

      // Ganho 1: Adiciona 6.000 XP (abaixo do teto de 10.000)
      const res1 = levelingSystem.addExperience(playerState, 6000);
      expect(res1.xpAwarded).toBe(6000);
      expect(playerState.dailyXpGained).toBe(6000);
      expect(playerState.isFatigued).toBe(false);

      // Ganho 2: Tenta adicionar 8.000 XP (deve ser limitado aos 4.000 restantes para atingir 10.000)
      const res2 = levelingSystem.addExperience(playerState, 8000);
      expect(res2.xpAwarded).toBe(4000);
      expect(playerState.dailyXpGained).toBe(10000);
      expect(playerState.isFatigued).toBe(true);

      // Ganho 3: Tenta adicionar mais XP no mesmo ciclo diário (deve receber 0 XP devido ao cansaço)
      const res3 = levelingSystem.addExperience(playerState, 2000);
      expect(res3.xpAwarded).toBe(0);
      expect(playerState.dailyXpGained).toBe(10000);
      expect(playerState.isFatigued).toBe(true);

      // Simulação da virada do ciclo diário às 06:00 do próximo dia
      playerState.dailyCycleKey = '2020-01-01'; // ciclo passado
      playerRepo.savePlayerState(playerState);

      // Agora deve resetar a trava e permitir ganhar até mais 10.000 XP
      const res4 = levelingSystem.addExperience(playerState, 5000);
      expect(res4.xpAwarded).toBe(5000);
      expect(playerState.dailyXpGained).toBe(5000);
      expect(playerState.isFatigued).toBe(false);
    });
  });
});
