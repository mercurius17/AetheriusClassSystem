import { on, once, Game, printConsole } from 'skyrimPlatform';
import { MeridianController } from './meridianController';
import { PerkResolver } from '../shared/perkResolver';

const controller = new MeridianController();
once('tick', () => {
  PerkResolver.getInstance().setRuntimeLookup({
    getFormFromFile: (localId, plugin) => Game.getFormFromFile(localId, plugin)?.getFormId() ?? null
  });
  on('modEvent', (event: { eventName: string; strArg: string }) => {
    if (event.eventName !== 'AetheriusUI.ToView' || typeof event.strArg !== 'string' || event.strArg.length > 18 * 1024) return;
    try { controller.receive(JSON.parse(event.strArg)); } catch { printConsole('[ClassSystem] Estado de UI rejeitado.'); }
  });
  printConsole('[ClassSystem] Módulo Meridian inicializado. Abra CLASSE no radial da Aetherius UI.');
});
