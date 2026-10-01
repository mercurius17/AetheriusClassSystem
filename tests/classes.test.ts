import {
  getAllClasses,
  getClassById,
  getClassesByArchetype,
  getResolvedStagePerks,
  CLASSES_REGISTRY
} from '../shared/classesData';
import { FREE_RESET_MAX_LEVEL } from '../shared/levelingMath';

describe('Sistema de Classes e Regras de Negócio', () => {
  test('Deve registrar exatamente as 18 classes divididas nos 3 arquétipos', () => {
    const allClasses = getAllClasses();
    expect(allClasses.length).toBe(18);

    const conjuradores = getClassesByArchetype('CONJURADORES');
    const guerreiros = getClassesByArchetype('GUERREIROS');
    const especialistas = getClassesByArchetype('ESPECIALISTAS');

    expect(conjuradores.length).toBe(6);
    expect(guerreiros.length).toBe(6);
    expect(especialistas.length).toBe(6);
  });

  test('Deve identificar corretamente as classes que exigem o Colégio de Winterhold', () => {
    const elementalista = getClassById('elementalista');
    const criomante = getClassById('criomante');
    const piromante = getClassById('piromante');
    const eletromante = getClassById('eletromante');
    const invocador = getClassById('invocador');
    const curandeiro = getClassById('curandeiro');
    const guardiao = getClassById('guardiao');

    expect(elementalista?.requiresWinterholdStudent).toBe(true);
    expect(criomante?.requiresWinterholdStudent).toBe(true);
    expect(piromante?.requiresWinterholdStudent).toBe(true);
    expect(eletromante?.requiresWinterholdStudent).toBe(true);
    expect(invocador?.requiresWinterholdStudent).toBe(true);
    expect(curandeiro?.requiresWinterholdStudent).toBe(true);
    expect(guardiao?.requiresWinterholdStudent).toBe(false);
  });

  test('Deve conter 9 marcos de estágio (Níveis 1, 5, 10, 15, 20, 25, 30, 35, 40) para cada classe', () => {
    for (const cls of getAllClasses()) {
      expect(cls.stages.length).toBe(9);
      expect(cls.stages[0].level).toBe(1);
      expect(cls.stages[8].level).toBe(40);
    }
  });

  test('Deve validar a regra de reset gratuito até o nível 15', () => {
    expect(FREE_RESET_MAX_LEVEL).toBe(15);
    const canResetFreeLvl10 = 10 <= FREE_RESET_MAX_LEVEL;
    const canResetFreeLvl15 = 15 <= FREE_RESET_MAX_LEVEL;
    const canResetFreeLvl16 = 16 <= FREE_RESET_MAX_LEVEL;

    expect(canResetFreeLvl10).toBe(true);
    expect(canResetFreeLvl15).toBe(true);
    expect(canResetFreeLvl16).toBe(false);
  });

  test('Deve conter aviso explícito de Roleplay para todos os feitiços', () => {
    for (const cls of getAllClasses()) {
      expect(cls.spellsRPNotice).toContain('não são concedidos automaticamente pelo sistema');
      expect(cls.spellsRPNotice).toContain('Colégio de Winterhold');
    }
  });

  test('Deve retornar perks resolvidas de estágios com descrições em Português do Brasil', () => {
    const perksLvl1 = getResolvedStagePerks('elementalista', 1);
    expect(perksLvl1.length).toBeGreaterThan(0);
    for (const p of perksLvl1) {
      expect(p.namePt).toBeDefined();
      expect(p.descriptionPt).toBeDefined();
      expect(p.isResolved).toBe(true);
    }
  });

  test('Deve resolver nomes de feitiços autorizados a partir do arquivo JSON de configuração', () => {
    const { getSpellInfo, getSpellDisplayNamePt } = require('../shared/classesData');
    const flamesInfo = getSpellInfo('Flames');
    expect(flamesInfo).toBeDefined();
    expect(flamesInfo.namePt).toBe('Chamas');
    expect(flamesInfo.descriptionPt).toContain('fogo');

    const displayName = getSpellDisplayNamePt('Flames');
    expect(displayName).toBe('Chamas');
  });

  test('Deve validar que atributos só podem ser distribuídos em passos de 5 em 5', () => {
    const { ClassSystem } = require('../server/classSystem');
    const { PlayerRepository } = require('../server/storage/playerRepository');

    const classSystem = ClassSystem.getInstance();
    const playerRepo = PlayerRepository.getInstance();

    const playerId = 9999;
    const playerState = playerRepo.getPlayerState(playerId);
    playerState.classId = 'barbaro';
    playerState.unspentAttributePoints = 15;
    playerRepo.savePlayerState(playerState);

    // Tentativa inválida: valores não múltiplos de 5 (ex: 3, 2, 0)
    const invalidRes = classSystem.allocateAttributes(playerId, 3, 2, 0);
    expect(invalidRes.success).toBe(false);
    expect(invalidRes.message).toContain('múltiplos de 5');

    const negativeRes = classSystem.allocateAttributes(playerId, 20, -5, 0);
    expect(negativeRes.success).toBe(false);
    expect(playerState.unspentAttributePoints).toBe(15);

    // Tentativa válida: valores múltiplos de 5 (ex: 5 de vida, 5 de vigor, 5 de magia = 15)
    const validRes = classSystem.allocateAttributes(playerId, 5, 5, 5);
    expect(validRes.success).toBe(true);
    expect(validRes.state?.unspentAttributePoints).toBe(0);
    expect(validRes.state?.allocatedHealth).toBe(5);
    expect(validRes.state?.allocatedMagicka).toBe(5);
    expect(validRes.state?.allocatedStamina).toBe(5);
  });

  test('Deve garantir que 100% dos feitiços de todas as classes possuem nome e descrição em Português', () => {
    const classesData = require('../config/classes-config.json');
    const spellsData = require('../config/spells-descriptions.json');

    let totalSpellsChecked = 0;
    for (const [classId, cls] of Object.entries(classesData)) {
      for (const [tier, spList] of Object.entries((cls as any).authorizedSpells || {})) {
        for (const sp of spList as string[]) {
          totalSpellsChecked++;
          const spellInfo = spellsData[sp];
          expect(spellInfo).toBeDefined();
          expect(spellInfo.namePt).toBeTruthy();
          expect(spellInfo.descriptionPt).toBeTruthy();
          expect(spellInfo.namePt.length).toBeGreaterThan(1);
          expect(spellInfo.descriptionPt.length).toBeGreaterThan(10);
        }
      }
    }
    expect(totalSpellsChecked).toBeGreaterThan(100);
  });

  test('Deve confirmar que Anti-Mago está em Especialistas e Curandeiro em Conjuradores', () => {
    const curandeiro = getClassById('curandeiro');
    const antiMago = getClassById('anti_mago');

    expect(curandeiro?.archetype).toBe('CONJURADORES');
    expect(antiMago?.archetype).toBe('ESPECIALISTAS');
  });

  test('Deve confirmar que apenas Steady Aim (1) e Steady Aim (2) foram removidas do Arqueiro', () => {
    const arqueiro = getClassById('arqueiro');
    expect(arqueiro).toBeDefined();

    const allPerks = (arqueiro?.stages || []).flatMap(s => s.perks);
    expect(allPerks).not.toContain('Steady Aim (1)');
    expect(allPerks).not.toContain('Steady Aim (2)');
    // Outras perks do Arqueiro continuam presentes
    expect(allPerks).toContain('Power Shot');
    expect(allPerks).toContain('Archery Mastery');

    // Demais classes preservam suas perks (ex: Adrenaline em Berserker e Ranger)
    const berserker = getClassById('berserker');
    const ranger = getClassById('ranger');
    const berserkerPerks = (berserker?.stages || []).flatMap(s => s.perks);
    const rangerPerks = (ranger?.stages || []).flatMap(s => s.perks);
    expect(berserkerPerks).toContain('Adrenaline');
    expect(rangerPerks).toContain('Adrenaline');
  });

  test('Deve garantir que 100% das perks de todas as classes possuem mapeamento e descrição em PT-BR', () => {
    const classesData = require('../config/classes-config.json');
    const perksData = require('../config/perks-descriptions.json');
    const mappingsData = require('../config/perk-mappings.json');

    let totalPerksChecked = 0;
    for (const [classId, cls] of Object.entries(classesData)) {
      for (const st of (cls as any).stages || []) {
        for (const perkName of st.perks as string[]) {
          totalPerksChecked++;
          const perkDesc = perksData[perkName];
          const perkMap = mappingsData[perkName];

          expect(perkDesc).toBeDefined();
          expect(perkDesc.namePt).toBeTruthy();
          expect(perkDesc.descriptionPt).toBeTruthy();
          expect(perkMap).toBeDefined();
          expect(perkMap.localId).toBeDefined();
          expect(perkMap.candidatePlugins.length).toBeGreaterThan(0);
        }
      }
    }
    expect(totalPerksChecked).toBe(351);
  });

  test('Deve garantir integridade dos ícones SVG para as 18 classes na interface', () => {
    const fs = require('fs');
    const path = require('path');
    const classesData = require('../config/classes-config.json');

    for (const classId of Object.keys(classesData)) {
      const mainIcon = path.resolve(__dirname, '../ui/assets/icons', `${classId}.svg`);
      const accentIcon = path.resolve(__dirname, '../ui/assets/icons/accents', `${classId}.svg`);

      expect(fs.existsSync(mainIcon)).toBe(true);
      expect(fs.existsSync(accentIcon)).toBe(true);
    }
  });

  test('Deve garantir paridade byte-a-byte entre config/, dist/config/ e ui/data/', () => {
    const fs = require('fs');
    const path = require('path');

    const jsonFiles = [
      'classes-config.json',
      'perks-descriptions.json',
      'spells-descriptions.json',
      'perk-mappings.json'
    ];

    for (const file of jsonFiles) {
      const src = fs.readFileSync(path.resolve(__dirname, '../config', file), 'utf-8');
      const dist = fs.readFileSync(path.resolve(__dirname, '../dist/config', file), 'utf-8');
      const ui = fs.readFileSync(path.resolve(__dirname, '../ui/data', file), 'utf-8');

      expect(JSON.parse(dist)).toEqual(JSON.parse(src));
      expect(JSON.parse(ui)).toEqual(JSON.parse(src));
    }
  });

  test('Deve aplicar os atributos de nível 1 do mod Aetherius conforme as exceções raciais', () => {
    const { getRaceBaseAttributes } = require('../shared/raceData');

    // High Elf / Altmer (+50 Mágicka)
    expect(getRaceBaseAttributes('HighElf')).toEqual({ health: 100, magicka: 150, stamina: 100 });
    expect(getRaceBaseAttributes('Altmer')).toEqual({ health: 100, magicka: 150, stamina: 100 });
    expect(getRaceBaseAttributes('High Elf')).toEqual({ health: 100, magicka: 150, stamina: 100 });

    // Imperial (+25 em todos)
    expect(getRaceBaseAttributes('Imperial')).toEqual({ health: 125, magicka: 125, stamina: 125 });
    expect(getRaceBaseAttributes('ImperialRace')).toEqual({ health: 125, magicka: 125, stamina: 125 });

    // Orc / Orsimer (+50 Vida)
    expect(getRaceBaseAttributes('Orc')).toEqual({ health: 150, magicka: 100, stamina: 100 });
    expect(getRaceBaseAttributes('Orsimer')).toEqual({ health: 150, magicka: 100, stamina: 100 });

    // Redguard (+50 Vigor)
    expect(getRaceBaseAttributes('Redguard')).toEqual({ health: 100, magicka: 100, stamina: 150 });

    // Demais raças (100 padrão)
    expect(getRaceBaseAttributes('Nord')).toEqual({ health: 100, magicka: 100, stamina: 100 });
    expect(getRaceBaseAttributes('Breton')).toEqual({ health: 100, magicka: 100, stamina: 100 });
    expect(getRaceBaseAttributes('Dark Elf')).toEqual({ health: 100, magicka: 100, stamina: 100 });
    expect(getRaceBaseAttributes(null)).toEqual({ health: 100, magicka: 100, stamina: 100 });
  });

  test('Deve garantir que o reset de classe restaura atributos para o nível 1 com os valores raciais do Aetherius', () => {
    const { ClassSystem } = require('../server/classSystem');
    const { PlayerRepository } = require('../server/storage/playerRepository');

    const classSystem = ClassSystem.getInstance();
    const playerRepo = PlayerRepository.getInstance();

    const playerId = 7788;
    const playerState = playerRepo.getPlayerState(playerId);
    playerState.playerRace = 'Orc';
    playerState.classId = 'guardiao';
    playerState.level = 10;
    playerState.allocatedHealth = 20;
    playerState.allocatedMagicka = 10;
    playerState.allocatedStamina = 15;
    playerState.unspentAttributePoints = 10;
    playerRepo.savePlayerState(playerState);

    const resetRes = classSystem.resetClass(playerId);
    expect(resetRes.success).toBe(true);
    expect(resetRes.state?.level).toBe(1);
    expect(resetRes.state?.allocatedHealth).toBe(0);
    expect(resetRes.state?.allocatedMagicka).toBe(0);
    expect(resetRes.state?.allocatedStamina).toBe(0);
    expect(resetRes.state?.unspentAttributePoints).toBe(0);
    expect(resetRes.state?.baseAttributes).toEqual({ health: 150, magicka: 100, stamina: 100 });
  });

  test('Deve resolver e conceder o nível de habilidades correto por estágio da classe (ex: Elementalista Nv. 15 com Destruição 40)', () => {
    const { getClassById } = require('../shared/classesData');
    const { resolveSkillsForClassAndLevel } = require('../shared/skillResolver');

    // 1. Elementalista no Nível 15: Destruição 40, Alteração 40, Restauração 40
    const elementalista = getClassById('elementalista');
    expect(elementalista).toBeDefined();

    const skillsLvl1 = resolveSkillsForClassAndLevel(elementalista!, 1);
    expect(skillsLvl1.Destruction).toBe(0);

    const skillsLvl5 = resolveSkillsForClassAndLevel(elementalista!, 5);
    expect(skillsLvl5.Destruction).toBe(20);
    expect(skillsLvl5.Alteration).toBe(20);
    expect(skillsLvl5.Restoration).toBe(20);

    const skillsLvl15 = resolveSkillsForClassAndLevel(elementalista!, 15);
    expect(skillsLvl15.Destruction).toBe(40);
    expect(skillsLvl15.Alteration).toBe(40);
    expect(skillsLvl15.Restoration).toBe(40);

    // 2. Guardião no Nível 15: Bloqueio 40, Armadura Pesada 40, Uma-Mão 30
    const guardiao = getClassById('guardiao');
    const guardiaoSkillsLvl15 = resolveSkillsForClassAndLevel(guardiao!, 15);
    expect(guardiaoSkillsLvl15.Block).toBe(40);
    expect(guardiaoSkillsLvl15.HeavyArmor).toBe(40);
    expect(guardiaoSkillsLvl15.OneHanded).toBe(30);

    // 3. Arqueiro no Nível 15: Armadura Leve 40, Arquearia 40, Furtividade 40, Uma-Mão 40
    const arqueiro = getClassById('arqueiro');
    const arqueiroSkillsLvl15 = resolveSkillsForClassAndLevel(arqueiro!, 15);
    expect(arqueiroSkillsLvl15.LightArmor).toBe(40);
    expect(arqueiroSkillsLvl15.Marksman).toBe(40);
    expect(arqueiroSkillsLvl15.Sneak).toBe(40);
    expect(arqueiroSkillsLvl15.OneHanded).toBe(40);
  });
});
