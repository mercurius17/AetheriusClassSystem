import { ClassSystem } from './classSystem';
import { LevelingSystem } from './levelingSystem';
import { PartySystem } from './partySystem';
import { RaidSystem } from './raidSystem';
import { PlayerRepository } from './storage/playerRepository';
import { CombatKillEvent, PlayerClassState } from '../shared/types';
import { PerkResolver } from '../shared/perkResolver';

import { getClassRuntime } from './runtime';

export class SkyMPClassServer {
  private static instance: SkyMPClassServer;
  public classSystem: ClassSystem;
  public levelingSystem: LevelingSystem;
  public partySystem: PartySystem;
  public raidSystem: RaidSystem;
  public playerRepo: PlayerRepository;
  private recentKillReports = new Map<string, number>();
  private readonly killReportTtlMs = 10 * 60 * 1000;

  constructor() {
    this.classSystem = ClassSystem.getInstance();
    this.levelingSystem = LevelingSystem.getInstance();
    this.partySystem = PartySystem.getInstance();
    this.raidSystem = RaidSystem.getInstance();
    this.playerRepo = PlayerRepository.getInstance();
  }

  public static getInstance(): SkyMPClassServer {
    if (!SkyMPClassServer.instance) {
      SkyMPClassServer.instance = new SkyMPClassServer();
    }
    return SkyMPClassServer.instance;
  }

  public initialize(): void {
    const mp = getClassRuntime();
    console.log('[SkyMPClassServer] Inicializando Sistema de Classes, Leveling, Grupos e Raids...');

    // 1. Diagnóstico do PerkResolver
    const perkReport = PerkResolver.getInstance().initializeResolver();
    console.log(`[SkyMPClassServer] PerkResolver inicializado: ${perkReport.resolved}/${perkReport.total} perks registradas.`);

    // 2. Registro de propriedades no SkyMP se presente
    if (typeof mp !== 'undefined' && mp.makeProperty) {
      mp.makeProperty('playerClassData', {
        isVisibleByOwner: true,
        isVisibleByNeighbors: false,
        updateOwner: '',
        updateNeighbor: ''
      });

      mp.makeProperty('partyStateData', {
        isVisibleByOwner: true,
        isVisibleByNeighbors: false,
        updateOwner: '',
        updateNeighbor: ''
      });
    }

    console.log('[SkyMPClassServer] Pronto para processar eventos e conexões.');
  }

  /**
   * Regras de domínio usadas pelo adapter autenticado da Aetherius UI.
   */
  public handleClientPacket(playerId: number, packetType: string, payload: unknown): any {
    if (!Number.isSafeInteger(playerId) || playerId <= 0 || typeof packetType !== 'string') {
      return { type: 'error', message: 'Pacote inválido.' };
    }

    const data = payload && typeof payload === 'object'
      ? payload as Record<string, unknown>
      : {};
    const finiteNumber = (value: unknown): number | null =>
      typeof value === 'number' && Number.isFinite(value) ? value : null;
    const safeId = (value: unknown): number | null => {
      const parsed = finiteNumber(value);
      return parsed !== null && Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
    };

    switch (packetType) {
      case 'requestInitialData': {
        const state = this.playerRepo.getPlayerState(playerId);
        const party = this.partySystem.getPartyByPlayerId(playerId);
        return {
          type: 'syncPlayerState',
          data: {
            player: state,
            party: party || null
          }
        };
      }

      case 'selectClass': {
        if (typeof data.classId !== 'string' || data.classId.length > 64) {
          return { type: 'classSelectedResponse', data: { success: false, message: 'Classe inválida.' } };
        }
        const res = this.classSystem.selectClass(playerId, data.classId);
        return {
          type: 'classSelectedResponse',
          data: res
        };
      }

      case 'allocateAttributes': {
        const res = this.classSystem.allocateAttributes(
          playerId,
          finiteNumber(data.health) ?? 0,
          finiteNumber(data.magicka) ?? 0,
          finiteNumber(data.stamina) ?? 0
        );
        return {
          type: 'attributesAllocatedResponse',
          data: res
        };
      }

      case 'resetClass': {
        const res = this.classSystem.resetClass(playerId);
        return {
          type: 'resetClassResponse',
          data: res
        };
      }

      case 'createParty': {
        const party = this.partySystem.createParty(playerId);
        return { type: 'partyCreated', data: party };
      }

      case 'inviteParty': {
        const targetId = safeId(data.targetId);
        const res = targetId === null
          ? { success: false, message: 'Jogador alvo inválido.' }
          : this.partySystem.invitePlayer(playerId, targetId);
        return { type: 'partyInviteSent', data: res };
      }

      case 'acceptPartyInvite': {
        const res = typeof data.inviteId === 'string' && data.inviteId.length <= 160
          ? this.partySystem.acceptInvite(data.inviteId, playerId)
          : { success: false, message: 'Convite inválido.' };
        return { type: 'partyInviteAccepted', data: res };
      }

      case 'declinePartyInvite': {
        const res = typeof data.inviteId === 'string' && data.inviteId.length <= 160
          ? this.partySystem.declineInvite(data.inviteId, playerId)
          : { success: false, message: 'Convite inválido.' };
        return { type: 'partyInviteDeclined', data: res };
      }

      case 'leaveParty': {
        const res = this.partySystem.leaveParty(playerId);
        return { type: 'partyLeft', data: res };
      }

      case 'kickPartyMember': {
        const targetId = safeId(data.targetId);
        const res = targetId === null
          ? { success: false, message: 'Jogador alvo inválido.' }
          : this.partySystem.kickMember(playerId, targetId);
        return { type: 'partyMemberKicked', data: res };
      }

      case 'promotePartyLeader': {
        const newLeaderId = safeId(data.newLeaderId);
        const res = newLeaderId === null
          ? { success: false, message: 'Novo líder inválido.' }
          : this.partySystem.promoteLeader(playerId, newLeaderId);
        return { type: 'partyLeaderPromoted', data: res };
      }

      case 'convertToRaid': {
        const res = this.raidSystem.convertToRaid(playerId);
        return { type: 'raidConverted', data: res };
      }

      case 'assignRaidSubgroup': {
        const targetMemberId = safeId(data.targetMemberId);
        const subgroupId = finiteNumber(data.subgroupId);
        const res = targetMemberId === null || subgroupId === null || !Number.isSafeInteger(subgroupId)
          ? { success: false, message: 'Membro ou subgrupo inválido.' }
          : this.raidSystem.assignSubgroup(playerId, targetMemberId, subgroupId);
        return { type: 'raidSubgroupAssigned', data: res };
      }

      case 'reportCombatKill': {
        const victimId = safeId(data.victimId);
        if (victimId === null) {
          return {
            type: 'combatKillProcessed',
            data: { awardedPlayers: [], rejected: true, reason: 'Identificador da vítima inválido.' }
          };
        }

        const now = Date.now();
        const reportKey = `${playerId}:${victimId}`;
        const previousReport = this.recentKillReports.get(reportKey);
        if (previousReport !== undefined && now - previousReport < this.killReportTtlMs) {
          return {
            type: 'combatKillProcessed',
            data: { awardedPlayers: [], rejected: true, reason: 'Abate já processado.' }
          };
        }
        this.recentKillReports.set(reportKey, now);
        if (this.recentKillReports.size > 10_000) {
          for (const [key, timestamp] of this.recentKillReports) {
            if (now - timestamp >= this.killReportTtlMs) this.recentKillReports.delete(key);
          }
        }

        const event: CombatKillEvent = {
          killerId: playerId,
          victimId,
          victimName: typeof data.victimName === 'string' && data.victimName.trim()
            ? data.victimName.trim().slice(0, 128)
            : 'Inimigo',
          victimLevel: finiteNumber(data.victimLevel) ?? 1,
          victimBaseXp: finiteNumber(data.victimBaseXp) ?? 0,
          isDragonPriest: data.isDragonPriest === true,
          isDragon: data.isDragon === true
        };
        const pos = Array.isArray(data.pos) && data.pos.length === 3 && data.pos.every(v => typeof v === 'number' && Number.isFinite(v))
          ? data.pos as [number, number, number]
          : undefined;
        const cell = typeof data.cell === 'string' ? data.cell.slice(0, 256) : undefined;
        const res = this.levelingSystem.processCombatKill(event, pos, cell);
        return { type: 'combatKillProcessed', data: res };
      }

      default:
        return { type: 'error', message: `Tipo de pacote desconhecido: ${packetType}` };
    }
  }
}

// Inicializa a instância principal
export const serverInstance = SkyMPClassServer.getInstance();
if (require.main === module) serverInstance.initialize();
