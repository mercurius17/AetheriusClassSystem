import { PerkResolver } from '../shared/perkResolver';
import { resolveCombatProfile, publishCombatProfile } from '../server/combatProfileAdapter';
import { PlayerRepository } from '../server/storage/playerRepository';
const catalog = require('../config/verified-perks.json');
const state = () => ({playerId:0xff000001, unlockedPerks:['One-Handed Mastery'], allocatedHealth:0,allocatedMagicka:0,allocatedStamina:0,baseAttributes:{health:100,magicka:100,stamina:100},combatRevision:0});
test('production resolver never marks a synthetic perk resolved', () => {
  const perk = new PerkResolver().resolvePerk('Imaginary Perk');
  expect(perk.isResolved).toBe(false); expect(perk.resolvedFormId).toBe(0); expect(perk.strategyUsed).toBe('UNRESOLVED');
});
test('server adapter uses exact skills and stable audited origins', () => {
  const profile = resolveCombatProfile(state(), {OneHanded:60}, 1, catalog);
  expect(profile.skills.OneHanded).toBe(60); expect(profile.skills.Block).toBe(0);
  expect(profile.perks[0].key).toBe('Skyrim.esm:0BABE4');
});
test('native publish failure cannot advance persisted revision', () => {
  const s=state();
  expect(() => publishCombatProfile({getActorCombatProfile:()=>'{"revision":10}',applyActorCombatProfile:()=>{throw new Error('rejected');}},s,{},catalog)).toThrow();
  expect(s.combatRevision).toBe(0);
});
test('unsupported loaded perk does not overwrite persisted progression with a default character', () => {
  const repo=PlayerRepository.getInstance(); repo.clearMemory();
  const stored={...state(),classId:'guardiao',level:20,unlockedPerks:['Imaginary Perk']};
  const native={get:()=>JSON.stringify(stored),set:jest.fn(),getServerSettings:()=>({aetheriusCombatSettings:{enabled:true,mode:'aetherius'}}),
    getActorCombatProfile:()=>'{"revision":0}',applyActorCombatProfile:jest.fn()};
  const previous=(global as any).mp; (global as any).mp=native;
  try {
    expect(()=>repo.getPlayerState(stored.playerId)).toThrow(/audited/);
    expect(native.set).not.toHaveBeenCalled(); expect(native.applyActorCombatProfile).not.toHaveBeenCalled();
  } finally { (global as any).mp=previous; repo.clearMemory(); }
});
