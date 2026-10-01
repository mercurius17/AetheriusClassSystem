import { Game, Form, printConsole } from 'skyrimPlatform';
import { PerkResolver } from '../shared/perkResolver';
import { PlayerClassState } from '../shared/types';
import { getRaceBaseAttributes } from '../shared/raceData';

export class ClientPerkApplier {
  private static instance: ClientPerkApplier;
  private appliedPerks: Map<string, Form> = new Map();
  private resolver: PerkResolver;

  constructor() {
    this.resolver = PerkResolver.getInstance();
    // Registra gancho de resolução nativa para o resolver
    this.resolver.setRuntimeLookup({
      getFormFromFile: (localId: number, pluginName: string) => {
        try {
          if (typeof Game !== 'undefined' && Game.getFormFromFile) {
            const form = Game.getFormFromFile(localId, pluginName);
            return form ? form.getFormId() : null;
          }
        } catch (err) {
          printConsole(`[ClientPerkApplier] Erro no getFormFromFile: ${err}`);
        }
        return null;
      }
    });
  }

  public static getInstance(): ClientPerkApplier {
    if (!ClientPerkApplier.instance) {
      ClientPerkApplier.instance = new ClientPerkApplier();
    }
    return ClientPerkApplier.instance;
  }

  /**
   * Sincroniza as perks do jogador local com base no estado de classe recebido do servidor.
   * Aplica novas perks liberadas e remove perks que não pertencem mais ao jogador (em caso de reset/respec).
   */
  public syncPerks(playerState: PlayerClassState | null): {
    applied: string[];
    removed: string[];
    failed: string[];
  } {
    const report = {
      applied: [] as string[],
      removed: [] as string[],
      failed: [] as string[]
    };

    if (typeof Game === 'undefined' || !Game.getPlayer) {
      return report;
    }

    const player = Game.getPlayer();
    if (!player) {
      return report;
    }

    // Se o jogador não tem classe ou realizou reset, remove todas as perks anteriormente aplicadas
    if (!playerState || !playerState.classId) {
      this.removeAllAppliedPerks();
      return report;
    }

    const targetPerkIds = new Set(playerState.unlockedPerks || []);

    // 1. Remove perks que não estão mais na lista de desbloqueadas
    for (const [perkId, perkForm] of Array.from(this.appliedPerks.entries())) {
      if (!targetPerkIds.has(perkId)) {
        try {
          player.removePerk(perkForm);
          report.removed.push(perkId);
          printConsole(`[ClientPerkApplier] Removida perk: ${perkId}`);
        } catch (err) {
          printConsole(`[ClientPerkApplier] Falha ao remover perk ${perkId}: ${err}`);
        }
        this.appliedPerks.delete(perkId);
      }
    }

    // 2. Aplica novas perks que ainda não estão registradas como aplicadas
    for (const perkId of targetPerkIds) {
      if (this.appliedPerks.has(perkId)) {
        continue;
      }

      const perkForm = this.findPerkForm(perkId);
      if (perkForm) {
        try {
          player.addPerk(perkForm);
          this.appliedPerks.set(perkId, perkForm);
          report.applied.push(perkId);
          printConsole(`[ClientPerkApplier] Aplicada perk: ${perkId}`);
        } catch (err) {
          printConsole(`[ClientPerkApplier] Falha ao adicionar perk ${perkId}: ${err}`);
          report.failed.push(perkId);
        }
      } else {
        printConsole(`[ClientPerkApplier] [AVISO] FormID não encontrado para a perk: ${perkId}`);
        report.failed.push(perkId);
      }
    }

    return report;
  }

  /**
   * Localiza o objeto Form da perk iterando pelos plugins candidatos definidos no PerkResolver.
   */
  public findPerkForm(perkId: string): Form | null {
    if (typeof Game === 'undefined') {
      return null;
    }

    const mapping = this.resolver.getMapping(perkId);
    if (mapping && Game.getFormFromFile) {
      const localIdNum = parseInt(mapping.localId, 16) || 0;
      for (const plugin of mapping.candidatePlugins) {
        try {
          const form = Game.getFormFromFile(localIdNum, plugin);
          if (form) {
            return form;
          }
        } catch {
          // Continua para o próximo candidato
        }
      }
    }

    const resolved = this.resolver.resolvePerk(perkId);
    if (resolved && resolved.isResolved && resolved.strategyUsed !== 'FALLBACK_MOCK' && Game.getFormEx) {
      try {
        const form = Game.getFormEx(resolved.resolvedFormId);
        if (form) {
          return form;
        }
      } catch {
        // Falhou na recuperação direta
      }
    }

    return null;
  }

  /**
   * Remove todas as perks de classe gerenciadas pelo sistema.
   */
  public removeAllAppliedPerks(): void {
    if (typeof Game === 'undefined' || !Game.getPlayer) {
      this.appliedPerks.clear();
      return;
    }

    const player = Game.getPlayer();
    if (!player) {
      this.appliedPerks.clear();
      return;
    }

    for (const [perkId, perkForm] of Array.from(this.appliedPerks.entries())) {
      try {
        player.removePerk(perkForm);
        printConsole(`[ClientPerkApplier] Removida perk: ${perkId}`);
      } catch (err) {
        printConsole(`[ClientPerkApplier] Erro ao remover perk ${perkId}: ${err}`);
      }
    }
    this.appliedPerks.clear();
  }

  /**
   * Retorna os IDs das perks atualmente aplicadas pelo cliente.
   */
  public getAppliedPerkIds(): string[] {
    return Array.from(this.appliedPerks.keys());
  }

  /**
   * Sincroniza o nível de habilidades (skills) do jogador com base no estágio da classe.
   * Eleva a habilidade caso o valor atual no ator seja menor que a meta da classe.
   */
  public syncSkills(playerState: PlayerClassState | null): Record<string, number> {
    const updated: Record<string, number> = {};
    if (typeof Game === 'undefined' || !Game.getPlayer) return updated;

    const player = Game.getPlayer();
    if (!player) return updated;

    if (!playerState || !playerState.unlockedSkills) {
      return updated;
    }

    for (const [skillName, targetVal] of Object.entries(playerState.unlockedSkills)) {
      try {
        const curVal = player.getActorValue(skillName);
        if (curVal !== targetVal) {
          player.setActorValue(skillName, targetVal);
          updated[skillName] = targetVal;
          printConsole(`[ClientPerkApplier] Habilidade ${skillName} atualizada de ${curVal} para ${targetVal} (Estágio da Classe)`);
        }
      } catch (err) {
        printConsole(`[ClientPerkApplier] Erro ao sincronizar habilidade ${skillName}: ${err}`);
      }
    }

    return updated;
  }

  /**
   * Sincroniza os atributos base e alocados no ator local (Vida, Mágicka, Vigor)
   * respeitando as regras raciais do mod Aetherius.
   */
  public syncAttributes(playerState: PlayerClassState | null): void {
    if (typeof Game === 'undefined' || !Game.getPlayer) return;

    const player = Game.getPlayer();
    if (!player) return;

    let raceName: string | undefined = playerState?.playerRace;
    if (!raceName && player.getRace) {
      try {
        const raceForm = player.getRace();
        if (raceForm && raceForm.getName) {
          raceName = raceForm.getName();
        }
      } catch {
        // Ignora
      }
    }

    const base = playerState?.baseAttributes || getRaceBaseAttributes(raceName);
    const health = base.health + (playerState?.allocatedHealth || 0);
    const magicka = base.magicka + (playerState?.allocatedMagicka || 0);
    const stamina = base.stamina + (playerState?.allocatedStamina || 0);

    try {
      player.setActorValue('Health', health);
      player.setActorValue('Magicka', magicka);
      player.setActorValue('Stamina', stamina);
      printConsole(`[ClientPerkApplier] Atributos sincronizados: Vida ${health}, Mágicka ${magicka}, Vigor ${stamina}`);
    } catch (err) {
      printConsole(`[ClientPerkApplier] Erro ao sincronizar atributos: ${err}`);
    }
  }
}
