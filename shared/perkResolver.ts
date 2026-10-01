import { PerkDescription, PerkMapping, ResolvedPerk, ResolutionStrategy } from './types';

const rawPerksDesc = require('../config/perks-descriptions.json');
const rawPerkMappings = require('../config/perk-mappings.json');
const defaultPerksDesc: Record<string, PerkDescription> = (rawPerksDesc.default || rawPerksDesc);
const defaultPerkMappings: Record<string, PerkMapping> = (rawPerkMappings.default || rawPerkMappings);

export interface RuntimeFormLookup {
  /**
   * Equivalente ao Game.getFormFromFile(localId, pluginName) do Skyrim / Skyrim Platform.
   * Retorna o formId numérico de 32 bits (ex: 0x08123456) ou 0/null se não encontrado.
   */
  getFormFromFile?: (localId: number, pluginName: string) => number | null | undefined;

  /**
   * Busca por Editor ID (disponível via SKSE / PO3 / SkyrimPlatform / SkyMP espm lookup).
   */
  getFormByEditorId?: (editorId: string) => number | null | undefined;

  /**
   * Busca por Nome Canônico / Display Name nos registros do tipo PERK.
   */
  getFormByName?: (recordType: string, fullName: string) => number | null | undefined;

  /**
   * Lista de plugins atualmente carregados (load order).
   */
  loadedPlugins?: string[];
}

export class PerkResolver {
  private static instance: PerkResolver;
  private cache: Map<string, ResolvedPerk> = new Map();
  private descriptions: Record<string, PerkDescription>;
  private mappings: Record<string, PerkMapping>;
  private runtimeLookup: RuntimeFormLookup | null = null;

  constructor(
    customDescriptions?: Record<string, PerkDescription>,
    customMappings?: Record<string, PerkMapping>,
    runtimeLookup?: RuntimeFormLookup
  ) {
    this.descriptions = customDescriptions || defaultPerksDesc;
    this.mappings = customMappings || defaultPerkMappings;
    this.runtimeLookup = runtimeLookup || null;
  }

  public static getInstance(): PerkResolver {
    if (!PerkResolver.instance) {
      PerkResolver.instance = new PerkResolver();
    }
    return PerkResolver.instance;
  }

  public setRuntimeLookup(lookup: RuntimeFormLookup): void {
    this.runtimeLookup = lookup;
    this.cache.clear(); // Limpa cache para reavaliar com novo lookup
  }

  /**
   * Resolve uma perk pelo seu nome canônico utilizando a esteira de estratégias (Fallback Chain).
   */
  public resolvePerk(perkName: string): ResolvedPerk {
    const cleanName = perkName.trim();

    // 0. Consulta no Cache
    if (this.cache.has(cleanName)) {
      return this.cache.get(cleanName)!;
    }

    const desc = this.descriptions[cleanName] || {
      name: cleanName,
      namePt: cleanName,
      descriptionPt: `Habilidade de combate: ${cleanName}.`
    };

    const mapping = this.mappings[cleanName] || {
      name: cleanName,
      localId: '0x000000',
      candidatePlugins: ['Vokrii - Minimalistic Perks of Skyrim.esp', 'Vokrii.esp', 'Skyrim.esm'],
      editorIdAliases: [cleanName]
    };

    let resolvedFormId = 0;
    let pluginFound: string | null = null;
    let strategyUsed: ResolutionStrategy = 'UNRESOLVED';
    let isResolved = false;

    if (this.runtimeLookup) {
      // ESTRATÉGIA 1: Resolução por Local ID + Plugins Candidatos (Game.getFormFromFile)
      if (this.runtimeLookup.getFormFromFile && mapping.candidatePlugins && mapping.candidatePlugins.length > 0) {
        const localIdNum = parseInt(mapping.localId, 16) || 0;
        for (const plugin of mapping.candidatePlugins) {
          const form = this.runtimeLookup.getFormFromFile(localIdNum, plugin);
          if (form && form > 0) {
            resolvedFormId = form;
            pluginFound = plugin;
            strategyUsed = 'LOCAL_ID_PLUGIN';
            isResolved = true;
            break;
          }
        }
      }

      // ESTRATÉGIA 2: Resolução por Editor ID e Aliases
      if (!isResolved && this.runtimeLookup.getFormByEditorId && mapping.editorIdAliases) {
        for (const alias of mapping.editorIdAliases) {
          const form = this.runtimeLookup.getFormByEditorId(alias);
          if (form && form > 0) {
            resolvedFormId = form;
            strategyUsed = 'EDITOR_ID';
            isResolved = true;
            break;
          }
        }
      }

      // ESTRATÉGIA 3: Varredura Semântica por Nome Oficial nos Registros PERK
      if (!isResolved && this.runtimeLookup.getFormByName) {
        const form = this.runtimeLookup.getFormByName('PERK', cleanName) || this.runtimeLookup.getFormByName('PERK', desc.namePt);
        if (form && form > 0) {
          resolvedFormId = form;
          strategyUsed = 'SEMANTIC_NAME';
          isResolved = true;
        }
      }
    }

    const hex = '0x' + resolvedFormId.toString(16).toUpperCase().padStart(8, '0');

    const result: ResolvedPerk = {
      name: cleanName,
      namePt: desc.namePt,
      descriptionPt: desc.descriptionPt,
      resolvedFormId,
      hexFormId: hex,
      pluginFound,
      strategyUsed,
      isResolved
    };

    this.cache.set(cleanName, result);
    return result;
  }

  /**
   * Inicializa e valida a resolução de todas as perks cadastradas.
   * Gera um relatório de diagnóstico.
   */
  public initializeResolver(): { total: number; resolved: number; failed: string[] } {
    const allPerkNames = Object.keys(this.descriptions);
    let resolvedCount = 0;
    const failed: string[] = [];

    for (const name of allPerkNames) {
      const res = this.resolvePerk(name);
      if (res.isResolved) {
        resolvedCount++;
      } else {
        failed.push(name);
      }
    }

    return {
      total: allPerkNames.length,
      resolved: resolvedCount,
      failed
    };
  }

  /**
   * Retorna a descrição em Português do Brasil de uma perk pelo nome.
   */
  public getPerkDescriptionPt(perkName: string): string {
    const res = this.resolvePerk(perkName);
    return res.descriptionPt;
  }

  /**
   * Retorna o nome amigável em Português de uma perk.
   */
  public getPerkNamePt(perkName: string): string {
    const res = this.resolvePerk(perkName);
    return res.namePt;
  }

  /**
   * Retorna os dados técnicos de mapeamento da perk (localId, plugins candidatos, aliases).
   */
  public getMapping(perkName: string): PerkMapping | undefined {
    return this.mappings[perkName.trim()];
  }

  /**
   * Limpa o cache.
   */
  public clearCache(): void {
    this.cache.clear();
  }

}
