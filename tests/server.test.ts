import { SkyMPClassServer } from '../server';
import { PlayerRepository } from '../server/storage/playerRepository';

describe('Validação de pacotes do servidor', () => {
  const server = SkyMPClassServer.getInstance();

  beforeEach(() => {
    PlayerRepository.getInstance().clearMemory();
  });

  test('não lança exceção com payload ausente ou malformado', () => {
    expect(() => server.handleClientPacket(1, 'selectClass', null)).not.toThrow();
    expect(server.handleClientPacket(1, 'selectClass', null).data.success).toBe(false);
    expect(server.handleClientPacket(1, 'allocateAttributes', 'malformado').data.success).toBe(false);
  });

  test('rejeita ids e valores não numéricos', () => {
    expect(server.handleClientPacket(-1, 'requestInitialData', {}).type).toBe('error');
    expect(server.handleClientPacket(1, 'inviteParty', { targetId: '2' }).data.success).toBe(false);
    expect(server.handleClientPacket(1, 'assignRaidSubgroup', {
      targetMemberId: 2,
      subgroupId: Number.NaN
    }).data.success).toBe(false);
  });

  test('rejeita abates sem identidade e não processa a mesma vítima duas vezes', () => {
    const state = PlayerRepository.getInstance().getPlayerState(77);
    state.classId = 'arqueiro';

    const invalid = server.handleClientPacket(77, 'reportCombatKill', { victimName: 'Bandit' });
    expect(invalid.data.rejected).toBe(true);

    const payload = {
      victimId: 0xff001234,
      victimName: 'Bandit',
      victimLevel: 1,
      victimBaseXp: 9999,
      isDragon: true
    };
    const first = server.handleClientPacket(77, 'reportCombatKill', payload);
    const duplicate = server.handleClientPacket(77, 'reportCombatKill', payload);

    expect(first.data.awardedPlayers[0].xpAwarded).toBe(10);
    expect(duplicate.data.rejected).toBe(true);
  });
});
