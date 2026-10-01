import { PerkResolver, RuntimeFormLookup } from '../shared/perkResolver';

describe('PerkResolver - Camada de Resolução Dinâmica de FormIDs e Perks', () => {
  let resolver: PerkResolver;

  beforeEach(() => {
    resolver = new PerkResolver();
    resolver.clearCache();
  });

  test('Deve resolver perk com descrição completa e título em Português do Brasil', () => {
    const perk = resolver.resolvePerk('Destruction Mastery');
    expect(perk.name).toBe('Destruction Mastery');
    expect(perk.namePt).toBe('Maestria em Destruição');
    expect(perk.descriptionPt).toContain('Feitiços de Destruição custam 0,5% a menos de Mágicka');
    expect(perk.isResolved).toBe(true);
  });

  test('Deve simular resolução dinâmica com ordem de carregamento mutável (Load Order Independence)', () => {
    // Cenário 1: Vokrii carregado no slot 0x07
    const mockLookupSlot07: RuntimeFormLookup = {
      getFormFromFile: (localId: number, pluginName: string) => {
        if (pluginName.includes('Vokrii')) {
          const modIndex = 0x07;
          return ((modIndex << 24) | (0x0153CF & 0x00FFFFFF)) >>> 0;
        }
        return null;
      }
    };

    resolver.setRuntimeLookup(mockLookupSlot07);
    const perkSlot07 = resolver.resolvePerk('Destruction Mastery');
    expect(perkSlot07.strategyUsed).toBe('LOCAL_ID_PLUGIN');
    expect(perkSlot07.pluginFound).toContain('Vokrii');
    expect(perkSlot07.hexFormId.startsWith('0x07')).toBe(true);

    // Cenário 2: Load Order mudou, Vokrii agora está no slot 0x1A
    resolver.clearCache();
    const mockLookupSlot1A: RuntimeFormLookup = {
      getFormFromFile: (localId: number, pluginName: string) => {
        if (pluginName.includes('Vokrii')) {
          const modIndex = 0x1A;
          return ((modIndex << 24) | (0x0153CF & 0x00FFFFFF)) >>> 0;
        }
        return null;
      }
    };

    resolver.setRuntimeLookup(mockLookupSlot1A);
    const perkSlot1A = resolver.resolvePerk('Destruction Mastery');
    expect(perkSlot1A.hexFormId.startsWith('0x1A')).toBe(true);
    expect(perkSlot1A.resolvedFormId).not.toBe(perkSlot07.resolvedFormId);
  });

  test('Deve resolver via Editor ID Aliases quando arquivo de mod principal tiver nome diferente', () => {
    const mockLookupEditorId: RuntimeFormLookup = {
      getFormFromFile: () => null, // Não encontra pelo nome de arquivo padrão
      getFormByEditorId: (editorId: string) => {
        if (editorId === 'VKR_Impact' || editorId === 'Impact') {
          return 0x05012345;
        }
        return null;
      }
    };

    resolver.setRuntimeLookup(mockLookupEditorId);
    const perk = resolver.resolvePerk('Impact');
    expect(perk.strategyUsed).toBe('EDITOR_ID');
    expect(perk.resolvedFormId).toBe(0x05012345);
    expect(perk.namePt).toBe('Impacto');
  });

  test('Deve resolver via Varredura Semântica por Nome de Registro (Display Name)', () => {
    const mockLookupSemantic: RuntimeFormLookup = {
      getFormFromFile: () => null,
      getFormByEditorId: () => null,
      getFormByName: (type: string, name: string) => {
        if (type === 'PERK' && name === 'Shield Charge') {
          return 0x0205826F;
        }
        return null;
      }
    };

    resolver.setRuntimeLookup(mockLookupSemantic);
    const perk = resolver.resolvePerk('Shield Charge');
    expect(perk.strategyUsed).toBe('SEMANTIC_NAME');
    expect(perk.resolvedFormId).toBe(0x0205826F);
    expect(perk.namePt).toBe('Investida de Escudo');
  });

  test('Deve gerar relatório de inicialização sem falhas', () => {
    const report = resolver.initializeResolver();
    expect(report.total).toBeGreaterThan(100);
    expect(report.resolved).toBe(report.total);
    expect(report.failed.length).toBe(0);
  });
});
