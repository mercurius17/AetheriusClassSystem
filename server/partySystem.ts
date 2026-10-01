import { PartyMember, PartyState } from '../shared/types';
import { PlayerRepository } from './storage/playerRepository';

export class PartySystem {
  private static instance: PartySystem;
  private parties: Map<string, PartyState> = new Map();
  private playerToPartyMap: Map<number, string> = new Map();
  private pendingInvites: Map<string, { partyId: string; targetId: number; expiresAt: number }> = new Map();
  private inviteSequence = 0;

  public static getInstance(): PartySystem {
    if (!PartySystem.instance) {
      PartySystem.instance = new PartySystem();
    }
    return PartySystem.instance;
  }

  public createParty(leaderId: number): PartyState {
    // Se o jogador já estiver em party, sai primeiro
    if (this.playerToPartyMap.has(leaderId)) {
      this.leaveParty(leaderId);
    }

    const playerRepo = PlayerRepository.getInstance();
    const playerState = playerRepo.getPlayerState(leaderId);

    const partyId = `party_${leaderId}_${Date.now()}`;
    const leaderMember: PartyMember = {
      id: leaderId,
      name: playerState.playerName,
      classId: playerState.classId,
      className: playerState.className || 'Sem Classe',
      level: playerState.level,
      health: 100,
      maxHealth: 100,
      magicka: 100,
      maxMagicka: 100,
      stamina: 100,
      maxStamina: 100,
      isLeader: true,
      subgroupId: 1,
      pos: [0, 0, 0],
      cellOrWorldDesc: 'Tamriel',
      isOnline: true
    };

    const partyState: PartyState = {
      partyId,
      leaderId,
      isRaid: false,
      members: [leaderMember],
      maxMembers: 8
    };

    this.parties.set(partyId, partyState);
    this.playerToPartyMap.set(leaderId, partyId);

    playerState.partyId = partyId;
    playerState.isRaid = false;
    playerRepo.savePlayerState(playerState);

    return partyState;
  }

  public getPartyByPlayerId(playerId: number): PartyState | null {
    const partyId = this.playerToPartyMap.get(playerId);
    if (!partyId) return null;
    return this.parties.get(partyId) || null;
  }

  public getPartyById(partyId: string): PartyState | null {
    return this.parties.get(partyId) || null;
  }

  public getPendingInvites(playerId: number): Array<{ inviteId: string; partyId: string; expiresAt: number }> {
    const result = [];
    for (const [inviteId, invite] of this.pendingInvites) {
      if (invite.expiresAt <= Date.now()) { this.pendingInvites.delete(inviteId); continue; }
      if (invite.targetId === playerId) result.push({ inviteId, partyId: invite.partyId, expiresAt: invite.expiresAt });
    }
    return result;
  }

  public invitePlayer(leaderOrMemberId: number, targetPlayerId: number): { success: boolean; inviteId?: string; message: string } {
    const party = this.getPartyByPlayerId(leaderOrMemberId);
    if (!party) {
      return { success: false, message: 'Você precisa estar em um grupo para convidar.' };
    }

    if (party.leaderId !== leaderOrMemberId) {
      return { success: false, message: 'Apenas o líder pode convidar membros.' };
    }

    if (party.members.length >= party.maxMembers) {
      return { success: false, message: `O grupo já atingiu o limite máximo de ${party.maxMembers} membros.` };
    }

    if (this.playerToPartyMap.has(targetPlayerId)) {
      return { success: false, message: 'O jogador já está em outro grupo.' };
    }

    const inviteId = `invite_${targetPlayerId}_${Date.now()}_${++this.inviteSequence}`;
    this.pendingInvites.set(inviteId, {
      partyId: party.partyId,
      targetId: targetPlayerId,
      expiresAt: Date.now() + 60000 // 60 segundos
    });

    return { success: true, inviteId, message: 'Convite enviado com sucesso.' };
  }

  public acceptInvite(inviteId: string, playerId: number): { success: boolean; party?: PartyState; message: string } {
    const invite = this.pendingInvites.get(inviteId);
    if (!invite) {
      return { success: false, message: 'Convite inexistente ou expirado.' };
    }

    if (invite.targetId !== playerId) {
      return { success: false, message: 'Este convite não é direcionado a você.' };
    }

    if (Date.now() > invite.expiresAt) {
      this.pendingInvites.delete(inviteId);
      return { success: false, message: 'O convite expirou.' };
    }

    const party = this.parties.get(invite.partyId);
    if (!party) {
      this.pendingInvites.delete(inviteId);
      return { success: false, message: 'O grupo foi dissolvido.' };
    }

    if (party.members.length >= party.maxMembers) {
      this.pendingInvites.delete(inviteId);
      return { success: false, message: 'O grupo já está cheio.' };
    }
    // O jogador pode ter entrado em outro grupo enquanto este convite estava pendente.
    if (this.playerToPartyMap.has(playerId)) {
      this.pendingInvites.delete(inviteId);
      return { success: false, message: 'Você já está em outro grupo.' };
    }

    const playerRepo = PlayerRepository.getInstance();
    const playerState = playerRepo.getPlayerState(playerId);

    const newMember: PartyMember = {
      id: playerId,
      name: playerState.playerName,
      classId: playerState.classId,
      className: playerState.className || 'Sem Classe',
      level: playerState.level,
      health: 100,
      maxHealth: 100,
      magicka: 100,
      maxMagicka: 100,
      stamina: 100,
      maxStamina: 100,
      isLeader: false,
      subgroupId: Math.min(Math.floor((party.members.length) / 5) + 1, 4),
      pos: [0, 0, 0],
      cellOrWorldDesc: 'Tamriel',
      isOnline: true
    };

    party.members.push(newMember);
    this.playerToPartyMap.set(playerId, party.partyId);
    this.pendingInvites.delete(inviteId);

    playerState.partyId = party.partyId;
    playerState.isRaid = party.isRaid;
    playerRepo.savePlayerState(playerState);

    return { success: true, party, message: 'Você entrou no grupo.' };
  }

  public declineInvite(inviteId: string, playerId: number): { success: boolean; message: string } {
    const invite = this.pendingInvites.get(inviteId);
    if (!invite) {
      return { success: false, message: 'Convite inexistente ou expirado.' };
    }
    if (invite.targetId !== playerId) {
      return { success: false, message: 'Este convite não é direcionado a você.' };
    }
    this.pendingInvites.delete(inviteId);
    return { success: true, message: 'Convite recusado.' };
  }

  public leaveParty(playerId: number): { success: boolean; message: string } {
    const party = this.getPartyByPlayerId(playerId);
    if (!party) {
      return { success: false, message: 'Você não está em um grupo.' };
    }

    party.members = party.members.filter(m => m.id !== playerId);
    this.playerToPartyMap.delete(playerId);

    const playerRepo = PlayerRepository.getInstance();
    const playerState = playerRepo.getPlayerState(playerId);
    playerState.partyId = null;
    playerState.isRaid = false;
    playerRepo.savePlayerState(playerState);

    if (party.members.length === 0) {
      this.parties.delete(party.partyId);
      return { success: true, message: 'Grupo dissolvido.' };
    }

    // Se o líder saiu, passa a liderança para o próximo membro
    if (party.leaderId === playerId) {
      party.leaderId = party.members[0].id;
      party.members[0].isLeader = true;
    }

    return { success: true, message: 'Você saiu do grupo.' };
  }

  public kickMember(leaderId: number, targetPlayerId: number): { success: boolean; message: string } {
    const party = this.getPartyByPlayerId(leaderId);
    if (!party) {
      return { success: false, message: 'Você não está em um grupo.' };
    }

    if (party.leaderId !== leaderId) {
      return { success: false, message: 'Apenas o líder pode remover membros.' };
    }

    if (leaderId === targetPlayerId) {
      return { success: false, message: 'Você não pode expulsar a si mesmo (use Sair do Grupo).' };
    }
    if (!party.members.some(m => m.id === targetPlayerId)) {
      return { success: false, message: 'Jogador alvo não está no grupo.' };
    }

    party.members = party.members.filter(m => m.id !== targetPlayerId);
    this.playerToPartyMap.delete(targetPlayerId);

    const playerRepo = PlayerRepository.getInstance();
    const targetState = playerRepo.getPlayerState(targetPlayerId);
    targetState.partyId = null;
    targetState.isRaid = false;
    playerRepo.savePlayerState(targetState);

    return { success: true, message: 'Membro expulso do grupo.' };
  }

  public promoteLeader(currentLeaderId: number, newLeaderId: number): { success: boolean; message: string } {
    const party = this.getPartyByPlayerId(currentLeaderId);
    if (!party) return { success: false, message: 'Grupo não encontrado.' };
    if (party.leaderId !== currentLeaderId) return { success: false, message: 'Apenas o líder pode transferir a liderança.' };

    const newLeader = party.members.find(m => m.id === newLeaderId);
    if (!newLeader) return { success: false, message: 'Jogador alvo não está no grupo.' };

    const oldLeader = party.members.find(m => m.id === currentLeaderId);
    if (oldLeader) oldLeader.isLeader = false;
    newLeader.isLeader = true;
    party.leaderId = newLeaderId;

    return { success: true, message: `${newLeader.name} agora é o líder do grupo.` };
  }

  public updateMemberStats(
    playerId: number,
    stats: {
      health?: number;
      maxHealth?: number;
      magicka?: number;
      maxMagicka?: number;
      stamina?: number;
      maxStamina?: number;
      pos?: [number, number, number];
      cellOrWorldDesc?: string;
    }
  ): void {
    const party = this.getPartyByPlayerId(playerId);
    if (!party) return;

    const member = party.members.find(m => m.id === playerId);
    if (!member) return;

    const finiteNonNegative = (value: number): boolean => Number.isFinite(value) && value >= 0;
    if (stats.health !== undefined && finiteNonNegative(stats.health)) member.health = stats.health;
    if (stats.maxHealth !== undefined && finiteNonNegative(stats.maxHealth)) member.maxHealth = stats.maxHealth;
    if (stats.magicka !== undefined && finiteNonNegative(stats.magicka)) member.magicka = stats.magicka;
    if (stats.maxMagicka !== undefined && finiteNonNegative(stats.maxMagicka)) member.maxMagicka = stats.maxMagicka;
    if (stats.stamina !== undefined && finiteNonNegative(stats.stamina)) member.stamina = stats.stamina;
    if (stats.maxStamina !== undefined && finiteNonNegative(stats.maxStamina)) member.maxStamina = stats.maxStamina;
    if (stats.pos !== undefined && stats.pos.length === 3 && stats.pos.every(Number.isFinite)) member.pos = stats.pos;
    if (stats.cellOrWorldDesc !== undefined && stats.cellOrWorldDesc.length <= 256) member.cellOrWorldDesc = stats.cellOrWorldDesc;
  }

  /**
   * Retorna os membros que estão próximos do ponto de combate (raio <= 5000 unidades e mesma célula).
   */
  public getProximateMembers(
    partyId: string,
    centerPos: [number, number, number],
    centerCell: string,
    maxDistance: number = 5000
  ): PartyMember[] {
    const party = this.parties.get(partyId);
    if (!party) return [];

    return party.members.filter(m => {
      if (!m.isOnline) return false;
      // Se estiver em célula diferente, não divide XP
      if (m.cellOrWorldDesc !== centerCell) return false;

      // Distância Euclidiana em Skyrim
      const dx = m.pos[0] - centerPos[0];
      const dy = m.pos[1] - centerPos[1];
      const dz = m.pos[2] - centerPos[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      return dist <= maxDistance;
    });
  }

  public clearAll(): void {
    this.parties.clear();
    this.playerToPartyMap.clear();
    this.pendingInvites.clear();
    this.inviteSequence = 0;
  }
}
