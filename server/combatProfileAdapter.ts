/** Server-only boundary. Inputs are loaded progression state and resolved server skills. */
export const combatSkills = ['OneHanded','TwoHanded','Marksman','Block','HeavyArmor','LightArmor','Sneak','Destruction','Alteration','Restoration','Conjuration','Illusion','Alchemy','Enchanting','Smithing','Lockpicking','Speechcraft','Pickpocket'] as const;
export interface CombatProfile {
  schemaVersion: 1;
  revision: number;
  skills: Record<string,number>;
  perks: Array<{key:string;rank:number;source:'CLASS'}>;
  baseAttributes: {health:number;magicka:number;stamina:number};
}
export interface ClassCombatInput {
  playerId: number;
  unlockedPerks: string[];
  allocatedHealth: number;
  allocatedMagicka: number;
  allocatedStamina: number;
  baseAttributes?: {health:number;magicka:number;stamina:number};
  combatRevision?: number;
}
export interface VerifiedCatalog {schemaVersion:number;perks:Array<{name:string;key:string}>}
export interface NativeCombatApi {
  applyActorCombatProfile(actorId:number,profileJson:string):void;
  getActorCombatProfile(actorId:number):string;
}
const finite = (value:number,min:number,max:number,name:string):number => {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${name}`);
  return value;
};
export function resolveCombatProfile(state:ClassCombatInput, skills:Record<string,number>, revision:number, catalog:VerifiedCatalog):CombatProfile {
  if(!Number.isSafeInteger(revision) || revision < 1 || catalog.schemaVersion!==1) throw new Error('Invalid profile revision/catalog');
  const exact:Record<string,number> = {};
  for(const skill of combatSkills) exact[skill]=0;
  for(const [name,value] of Object.entries(skills)) {
    if(!combatSkills.includes(name as typeof combatSkills[number])) throw new Error(`Unknown skill ${name}`);
    exact[name]=finite(value,0,100,name);
  }
  const byName=new Map(catalog.perks.map(perk=>[perk.name,perk.key]));
  const keys=new Set<string>();
  const perks:CombatProfile['perks'] = [];
  for(const name of new Set(state.unlockedPerks)) {
    const key=byName.get(name);
    if(!key || !/^[^/\\:]+\.(?:esp|esm|esl):[0-9a-f]{6}$/i.test(key) || key.endsWith(':000000'))
      throw new Error(`Perk requires audited server handler: ${name}`);
    if(keys.has(key.toLowerCase())) throw new Error('Duplicate perk identity');
    keys.add(key.toLowerCase()); perks.push({key,rank:1,source:'CLASS'});
  }
  if(!state.baseAttributes) throw new Error('Missing authoritative race attributes');
  const baseAttributes={
    health:finite(state.baseAttributes.health,1,1e6,'health base')+finite(state.allocatedHealth,0,1e6,'allocatedHealth'),
    magicka:finite(state.baseAttributes.magicka,1,1e6,'magicka base')+finite(state.allocatedMagicka,0,1e6,'allocatedMagicka'),
    stamina:finite(state.baseAttributes.stamina,1,1e6,'stamina base')+finite(state.allocatedStamina,0,1e6,'allocatedStamina')
  };
  for(const [name,value] of Object.entries(baseAttributes)) finite(value,1,1e6,name);
  return {schemaVersion:1,revision,skills:exact,perks,baseAttributes};
}
export function publishCombatProfile(api:NativeCombatApi,state:ClassCombatInput,skills:Record<string,number>,catalog:VerifiedCatalog):CombatProfile {
  if(!Number.isSafeInteger(state.playerId) || state.playerId <= 0 || state.playerId > 0xffffffff) throw new Error('Invalid server actor ID');
  const native=JSON.parse(api.getActorCombatProfile(state.playerId)) as {revision:number};
  if(!Number.isSafeInteger(native.revision) || native.revision < 0) throw new Error('Invalid native revision');
  const current=state.combatRevision ?? 0;
  if(!Number.isSafeInteger(current) || current < 0) throw new Error('Invalid stored revision');
  const profile=resolveCombatProfile(state,skills,Math.max(current,native.revision)+1,catalog);
  api.applyActorCombatProfile(state.playerId,JSON.stringify(profile));
  state.combatRevision=profile.revision;
  return profile;
}
