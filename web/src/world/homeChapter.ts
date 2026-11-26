import type { FarmAction, PlotState } from './farmPlots.ts';

export type ChapterTask = 'kit' | 'refill' | 'sleep' | 'deliver';
type Bed = { tilled: boolean; age: number; wet: boolean };
export const chapterKey = 'lembah-asri:bab-pulang:v1';
export const chapterMode = () => new URLSearchParams(location.search).get('bab') === 'pulang';
export const chapterLabels: Record<ChapterTask,string> = {
  kit: 'Ambil bekal', refill: 'Isi gembor', sleep: 'Tidur sampai pagi', deliver: 'Serahkan kangkung'
};

export function newChapter(count: number) {
  return { day: 1, kit: false, seeds: 0, water: 0, bunch: 0, delivered: false,
    beds: Array.from({length: count}, (): Bed => ({tilled:false, age:-1, wet:false})) };
}
export type Chapter = ReturnType<typeof newChapter>;
export function readChapter(raw: string | null, count: number): Chapter {
  if (raw) {
    try {
      const s = JSON.parse(raw);
      const whole = (v: number) => Number.isSafeInteger(v) && v >= 0;
      if (s && whole(s.day) && s.day >= 1 && whole(s.seeds) && whole(s.water) && s.water <= 4 &&
          whole(s.bunch) && typeof s.kit === 'boolean' && typeof s.delivered === 'boolean' &&
          Array.isArray(s.beds) && s.beds.length === count && s.beds.every((b: Bed) =>
          b && typeof b.tilled === 'boolean' && typeof b.wet === 'boolean' &&
          Number.isInteger(b.age) && b.age >= -1 && b.age <= 2)) return s;
    } catch { /* Recover a damaged chapter slot. */ }
  }
  return newChapter(count);
}
export function chapterActions(s: Chapter, id: number): FarmAction[] {
  const b = s.beds[id];
  if (!s.kit || !b) return [];
  if (!b.tilled) return ['hoe'];
  if (b.age === -1) return s.seeds ? ['sow'] : [];
  if (b.age === 2) return ['harvest'];
  return !b.wet && s.water ? ['water'] : [];
}
export function workBed(s: Chapter, id: number, action: FarmAction) {
  if (!chapterActions(s,id).includes(action)) return false;
  const b = s.beds[id];
  switch(action) {
    case 'hoe': b.tilled = true; break;
    case 'sow': s.seeds--; b.age = 0; break;
    case 'water': s.water--; b.wet = true; break;
    case 'harvest': s.bunch++; b.age = -1; b.wet = false; break;
  }
  return true;
}
export function visit(s: Chapter, task: ChapterTask) {
  switch(task) {
    case 'kit':
      if (s.kit) return false;
      s.kit = true; s.seeds += 4; break;
    case 'refill':
      if (!s.kit || s.water === 4) return false;
      s.water = 4; break;
    case 'sleep':
      if (!s.kit) return false;
      s.day++;
      for (const b of s.beds) {
        if (b.wet && b.age >= 0 && b.age < 2) b.age++;
        b.wet = false;
      }
      break;
    case 'deliver':
      if (!s.bunch) return false;
      s.bunch--; s.seeds += s.delivered ? 2 : 4; s.delivered = true; break;
  }
  return true;
}
// Adapt day-based growth to the existing instanced crop and soil renderer.
export function chapterPlots(s: Chapter): PlotState[] {
  return s.beds.map(b => ({tilled:b.tilled, plantedAt:b.age >= 0 ? 1 : 0,
    wateredAt:b.wet ? 1 : 0, harvests:0,
    chapterStage: b.age < 0 ? 'bare' : b.age === 0 ? 'seed' : b.age === 1 ? 'sprout' : 'ripe'}));
}
