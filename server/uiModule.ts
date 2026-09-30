import { SkyMPClassServer } from './index';
import type { UiServerRouter } from '../vendor/ui-core/sdk/server/router';

// The Core supplies the authenticated actor. Payload identities are never used.
const actions = {
  snapshot: [], selectClass: ['classId'], allocateAttributes: ['health', 'magicka', 'stamina'], resetClass: [],
  createParty: [], inviteParty: ['targetId'], acceptPartyInvite: ['inviteId'], declinePartyInvite: ['inviteId'],
  leaveParty: [], kickPartyMember: ['targetId'], promotePartyLeader: ['newLeaderId'], convertToRaid: [],
  assignRaidSubgroup: ['targetMemberId', 'subgroupId']
} as const;

export function registerClassUi(router: Pick<UiServerRouter, 'register'>, server = SkyMPClassServer.getInstance()): () => void {
  const disposers: Array<() => void> = [];
  try {
    for (const [action, fields] of Object.entries(actions)) {
      disposers.push(router.register('class', action, (context, payload) => {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid class payload');
        const data = payload as Record<string, unknown>;
        if (Object.keys(data).some(key => !(fields as readonly string[]).includes(key))) throw new Error('Unknown class payload field');
        for (const key of fields) {
          const value = data[key];
          if (key === 'classId' || key === 'inviteId') {
            if (typeof value !== 'string' || !value || value.length > (key === 'classId' ? 64 : 160)) throw new Error('Invalid identifier');
          } else if (!Number.isSafeInteger(value) || (value as number) < (key.endsWith('Id') ? 1 : 0)) throw new Error('Invalid numeric field');
        }
        const result = server.handleClientPacket(context.actorId, action === 'snapshot' ? 'requestInitialData' : action, data);
        const snapshot = server.handleClientPacket(context.actorId, 'requestInitialData', {}).data;
        // Do not duplicate progression or large perk descriptions in the envelope.
        const { unlockedPerksData: _descriptions, ...player } = snapshot.player;
        const outcome = result.data as { success?: boolean; message?: string; inviteId?: string } | undefined;
        return { player, party: snapshot.party, invites: server.partySystem.getPendingInvites(context.actorId),
          result: action === 'snapshot' ? undefined : { success: outcome?.success, message: outcome?.message, inviteId: outcome?.inviteId } };
      }));
    }
  } catch (error) {
    disposers.reverse().forEach(dispose => dispose());
    throw error;
  }
  return () => disposers.splice(0).reverse().forEach(dispose => dispose());
}
