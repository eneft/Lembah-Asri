import { plantingPlaces, gardenHeightAt } from './gardenLayout.ts';
import { reachablePlot, type FarmAction } from './farmPlots.ts';
import type { GardenSurface } from './gardenSurface.ts';
import type { FarmHUD } from './homeFarm.ts';
import { HOME } from './homeStage.ts';
import { BRIDGE_DECK, BRIDGE_WALK } from './paintedBridge.ts';
import { chapterActions, chapterKey, chapterLabels, chapterPlots, newChapter, readChapter, visit, workBed, type ChapterTask } from './homeChapter.ts';

export class ChapterFarm {
  private state = newChapter(plantingPlaces.length);
  private storage?: Storage;
  private surface: GardenSurface;
  private listener?: (hud: FarmHUD | null) => void;
  private id = -1;
  private station = '';
  private onStorage = (e: StorageEvent) => {
    if (e.key === chapterKey || e.key === null) { this.load(); this.refresh(); }
  };
  constructor(surface: GardenSurface) {
    this.surface = surface;
    try { this.storage = window.localStorage; } catch { /* Session play */ }
    this.load(); this.refresh();
    window.addEventListener('storage', this.onStorage);
  }
  private load() {
    if (!this.storage) return;
    try { this.state = readChapter(this.storage.getItem(chapterKey), plantingPlaces.length); }
    catch { this.storage = undefined; }
  }
  private changed() {
    try { this.storage?.setItem(chapterKey, JSON.stringify(this.state)); }
    catch { this.storage = undefined; }
    this.refresh();
  }
  private refresh() {
    const plots = chapterPlots(this.state);
    this.surface.paintSoil(plots); this.surface.grow(plots, 1); this.publish();
  }
  setListener(fn?: (hud: FarmHUD | null) => void) { this.listener = fn; this.publish(); }
  update(x:number, y:number, z:number, facing:number) {
    const near = (a:number,b:number,r:number) => Math.hypot(x-a,z-b) <= r;
    const id = y-gardenHeightAt(x,z)<.4 ? reachablePlot(x,z,facing) : -1;
    const station = near(HOME.house.x,HOME.house.z+HOME.house.depth/2+1,3) ? 'Teras' :
      near(HOME.well.x,HOME.well.z,2.8) ? 'Sumur' :
      near(BRIDGE_WALK.startX-.6,BRIDGE_DECK.z,1.9) ? 'Bu Sari · seberang jembatan' : '';
    if (id === this.id && station === this.station) return;
    this.id = id; this.station = station; this.surface.select(id); this.publish();
  }
  private task(): ChapterTask | undefined {
    if (this.station === 'Teras') return this.state.kit ? 'sleep' : 'kit';
    if (this.station === 'Sumur' && this.state.kit && this.state.water<4) return 'refill';
    if (this.station.startsWith('Bu Sari') && this.state.bunch) return 'deliver';
  }
  interact(expected?: ChapterTask) {
    this.load();
    const task = this.task();
    if (task && (!expected || task === expected) && visit(this.state,task)) this.changed();
    else this.refresh();
  }
  act(action: FarmAction, expected = this.id) {
    if (this.id<0 || this.id!==expected) return false;
    this.load();
    if (!workBed(this.state,this.id,action)) { this.refresh(); return false; }
    this.changed(); return true;
  }
  private publish() {
    if (!this.listener) return;
    const s=this.state, p=plantingPlaces[this.id], b=s.beds[this.id], task=this.task();
    const goal = !s.kit ? 'Ambil bekal di teras rumah.' : s.delivered ? 'Titipan selesai. Tukar panen berikutnya dengan dua benih.' :
      s.bunch ? 'Seberangi jembatan barat dan temui Bu Sari.' :
      s.beds.some(b=>b.age===2) ? 'Kangkung siap dipanen.' :
      s.beds.some(b=>b.wet) ? 'Tidur di teras agar tanaman tumbuh.' :
      !s.water ? 'Isi gembor di sumur sebelah kiri rumah.' : 'Rawat kangkung di kebun sebelah kanan rumah.';
    this.listener({id:this.id, row:p ? p.row+1 : 0, spot:p ? p.place+1 : 0,
      description:b ? (!b.tilled ? 'Tanah belum dicangkul' : b.age<0 ? 'Tanah gembur' :
        ['Benih kangkung','Kecambah kangkung','Siap panen'][b.age])+(b.wet?' · basah':'') : goal,
      actions:chapterActions(s,this.id), harvests:s.bunch, saved:!!this.storage,
      chapter:{location:this.station || (p ? 'Kebun' : 'Pekarangan'),goal,day:s.day,seeds:s.seeds,water:s.water,
        task,label:task ? chapterLabels[task] : ''} });
  }
  dispose() { window.removeEventListener('storage',this.onStorage); this.listener=undefined; this.surface.dispose(); }
}
