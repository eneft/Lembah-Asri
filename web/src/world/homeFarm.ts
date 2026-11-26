import { GARDEN, gardenHeightAt, plantingPlaces } from './gardenLayout.ts';
import { GardenSurface } from './gardenSurface.ts';
import { FarmPlots, availableActions, cropStage, describePlot, reachablePlot, GROW_TIME, type FarmAction } from './farmPlots.ts';

export type FarmHUD = {
  chapter?: { location:string; goal:string; day:number; seeds:number; water:number;
    task?: import('./homeChapter.ts').ChapterTask; label:string };
  id: number; row: number; spot: number; description: string;
  actions: FarmAction[]; harvests: number; saved: boolean;
};

export class HomeFarm {
  private store: FarmPlots;
  private surface: GardenSurface;
  private selected = -1;
  private nextGrowth = Infinity;
  private listener?: (hud: FarmHUD | null) => void;
  private readonly onStorage = (event: StorageEvent) => {
    if (this.store.sync(event.key)) this.refresh(Date.now());
  };

  constructor(surface: GardenSurface) {
    this.surface = surface;
    let storage: Storage | null = null;
    try { storage = window.localStorage; } catch { /* This session can still play. */ }
    this.store = new FarmPlots(storage);
    this.refresh(Date.now());
    window.addEventListener('storage', this.onStorage);
  }

  setListener(fn: ((hud: FarmHUD | null) => void) | undefined) {
    this.listener = fn;
    this.publish(Date.now());
  }

  private publish(now: number) {
    if (!this.listener) return;
    const p = plantingPlaces[this.selected];
    if (!p) { this.listener(null); return; }
    const state = this.store.plots[p.id];
    this.listener({ id: p.id, row: p.row + 1, spot: p.place + 1,
      description: describePlot(state, now), actions: availableActions(state, now),
      harvests: this.store.plots.reduce((n, plot) => n + plot.harvests, 0),
      saved: this.store.storageAvailable });
  }

  private grow(now: number) {
    this.surface.grow(this.store.plots, now);
    this.nextGrowth = Infinity;
    for (const plot of this.store.plots) {
      if (!plot.plantedAt || !plot.wateredAt) continue;
      const stage = cropStage(plot, now);
      if (stage === 'ripe') continue;
      const start = Math.max(plot.plantedAt, plot.wateredAt);
      this.nextGrowth = Math.min(this.nextGrowth, start + (stage === 'seed' ? GROW_TIME / 5 : GROW_TIME));
    }
  }

  private refresh(now: number) {
    this.surface.paintSoil(this.store.plots);
    this.grow(now);
    this.publish(now);
  }

  update(x: number, y: number, z: number, facing: number) {
    const nearby = Math.abs(x - GARDEN.x) < 7 && Math.abs(z - GARDEN.z) < 7;
    const id = nearby && y - gardenHeightAt(x, z) < .40 ? reachablePlot(x, z, facing) : -1;
    const now = Date.now();
    const grew = now >= this.nextGrowth;
    if (grew) this.grow(now);
    if (id !== this.selected || grew) {
      this.selected = id;
      this.surface.select(id);
      this.publish(now);
    }
  }

  act(action: FarmAction, expectedId = this.selected) {
    if (expectedId < 0 || expectedId !== this.selected) return false;
    const now = Date.now();
    const changed = this.store.act(this.selected, action, now);
    this.refresh(now);
    return changed;
  }

  dispose() {
    window.removeEventListener('storage', this.onStorage);
    this.listener = undefined;
    this.surface.dispose();
  }
}
