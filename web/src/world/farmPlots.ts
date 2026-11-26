import { plantingPlaces } from './gardenLayout.ts';

export type FarmAction = 'hoe' | 'water' | 'sow' | 'harvest';
export type CropStage = 'bare' | 'seed' | 'sprout' | 'ripe';
export type PlotState = { chapterStage?: CropStage; tilled: boolean; wateredAt: number; plantedAt: number; harvests: number };
export const farmLabels: Record<FarmAction, string> = { hoe: 'Cangkul', water: 'Siram', sow: 'Tanam sawi', harvest: 'Panen' };
export const farmKeys = ['hoe', 'water', 'sow', 'harvest'] as const;
export const GROW_TIME = 120_000;
const prefix = 'lembah-asri:home-garden:v1:';
const blank = (): PlotState => ({ tilled: false, wateredAt: 0, plantedAt: 0, harvests: 0 });

export function cropStage(plot: PlotState, now: number): CropStage {
  if (plot.chapterStage) return plot.chapterStage;
  if (!plot.plantedAt) return 'bare';
  if (!plot.wateredAt) return 'seed';
  const age = now - Math.max(plot.plantedAt, plot.wateredAt);
  if (age >= GROW_TIME) return 'ripe';
  return age >= GROW_TIME / 5 ? 'sprout' : 'seed';
}

export function availableActions(plot: PlotState, now: number): FarmAction[] {
  if (!plot.tilled) return ['hoe'];
  if (cropStage(plot, now) === 'ripe') return ['harvest'];
  const actions: FarmAction[] = [];
  if (!plot.wateredAt) actions.push('water');
  if (!plot.plantedAt) actions.push('sow');
  return actions;
}

export function describePlot(plot: PlotState, now: number): string {
  if (!plot.tilled) return 'Tanah belum dicangkul';
  switch (cropStage(plot, now)) {
    case 'bare': return plot.wateredAt ? 'Tanah gembur dan basah' : 'Tanah gembur dan kering';
    case 'seed': return plot.wateredAt ? 'Benih sawi sudah disiram' : 'Benih sawi perlu air';
    case 'sprout': return 'Sawi bertunas';
    case 'ripe': return 'Sawi siap dipanen';
  }
}

function decode(raw: string | null): PlotState {
  if (!raw) return blank();
  try {
    const value = JSON.parse(raw);
    const nonnegative = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
    if (value && typeof value.tilled === 'boolean' && nonnegative(value.wateredAt) &&
        nonnegative(value.plantedAt) && nonnegative(value.harvests)) {
      return { tilled: value.tilled, wateredAt: value.tilled ? value.wateredAt : 0,
        plantedAt: value.tilled ? value.plantedAt : 0, harvests: value.harvests };
    }
  } catch { /* Recover only the affected planting place. */ }
  return blank();
}

type PlotStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Each spot has a stable save key, so working one row never overwrites another. */
export class FarmPlots {
  readonly plots = plantingPlaces.map(blank);
  storageAvailable: boolean;
  private storage: PlotStorage | null;
  constructor(storage: PlotStorage | null) {
    this.storage = storage;
    this.storageAvailable = storage !== null;
    this.reload();
  }

  reload() {
    if (!this.storageAvailable || !this.storage) return;
    try {
      for (const p of plantingPlaces) this.plots[p.id] = decode(this.storage.getItem(prefix + p.id));
    } catch { this.storageAvailable = false; }
  }

  sync(key: string | null) {
    if (key !== null && !key.startsWith(prefix)) return false;
    this.reload();
    return true;
  }

  act(id: number, action: FarmAction, now: number): boolean {
    if (!Number.isInteger(id) || !this.plots[id]) return false;
    const key = prefix + id;
    if (this.storageAvailable && this.storage) {
      try { this.plots[id] = decode(this.storage.getItem(key)); }
      catch { this.storageAvailable = false; }
    }
    const plot = this.plots[id];
    if (!availableActions(plot, now).includes(action)) return false;
    const next = { ...plot };
    switch (action) {
      case 'hoe': next.tilled = true; break;
      case 'water': next.wateredAt = now; break;
      case 'sow': next.plantedAt = now; break;
      case 'harvest': Object.assign(next, blank(), { harvests: plot.harvests + 1 }); break;
    }
    this.plots[id] = next;
    if (this.storageAvailable && this.storage) {
      try { this.storage.setItem(key, JSON.stringify(next)); }
      catch { this.storageAvailable = false; }
    }
    return true;
  }
}

export function reachablePlot(x: number, z: number, facing: number): number {
  let nearest = -1, best = Infinity;
  const forwardX = Math.sin(facing), forwardZ = Math.cos(facing);
  for (const place of plantingPlaces) {
    const dx = place.x - x, dz = place.z - z;
    if (dx * dx + dz * dz > 1.65 * 1.65) continue;
    const score = (dx - .58 * forwardX) ** 2 + (dz - .58 * forwardZ) ** 2;
    if (score < best) { nearest = place.id; best = score; }
  }
  return nearest;
}
