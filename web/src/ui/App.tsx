import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Game, type PerformanceStats } from '../world/Game';
import { downloadWorldJSON } from '../world/worldExport';
import type { FarmHUD } from '../world/homeFarm';
import { farmKeys, farmLabels } from '../world/farmPlots';
import { CONTROL_MODE_KEY, parseControlPreference, resolveControlMode, type ControlPreference } from './controlMode';

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game>();
  const joystickRef = useRef<HTMLDivElement>(null);
  const joystickThumbRef = useRef<HTMLDivElement>(null);
  const runActiveRef = useRef(false);
  const [runActive, setRunActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState('');
  const [farm, setFarm] = useState<FarmHUD | null>(null);
  const [showPerformance, setShowPerformance] = useState(false);
  const [performanceSample, setPerformanceSample] = useState<PerformanceStats>();
  const [error, setError] = useState('');
  const [controlPreference, setControlPreference] = useState<ControlPreference>(() => {
    try { return parseControlPreference(window.localStorage.getItem(CONTROL_MODE_KEY)); }
    catch { return 'auto'; }
  });
  const [coarsePointer, setCoarsePointer] = useState(
    () => window.matchMedia('(pointer: coarse)').matches
  );
  const [compactScreen, setCompactScreen] = useState(
    () => window.matchMedia('(max-width: 700px)').matches
  );
  const controlMode = resolveControlMode(controlPreference, coarsePointer, compactScreen);

  // Auto mode follows actual browser capabilities. Explicit Desktop/Tablet
  // always wins, even on hybrid Windows PCs with touch + mouse at once.
  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)');
    const compact = window.matchMedia('(max-width: 700px)');
    const update = () => {
      setCoarsePointer(coarse.matches);
      setCompactScreen(compact.matches);
    };
    update();
    coarse.addEventListener('change', update);
    compact.addEventListener('change', update);
    return () => {
      coarse.removeEventListener('change', update);
      compact.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    if (!host.current) return;
    let game: Game | undefined;
    let active = true;
    Game.create(host.current).then(instance => {
      if (!active) { instance.dispose(); return; }
      game = instance;
      gameRef.current = instance;
      instance.setTouchRun(runActiveRef.current);
      instance.setFarmListener(setFarm);
      setReady(true);
    }).catch(reason => setError(String(reason)));
    return () => { active = false; gameRef.current = undefined; game?.dispose(); };
  }, []);

  const moveStick = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = joystickRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const radius = bounds.width * 0.34;
    const dx = event.clientX - (bounds.left + bounds.width / 2);
    const dy = event.clientY - (bounds.top + bounds.height / 2);
    const distance = Math.hypot(dx, dy);
    const scale = distance > radius ? radius / distance : 1;
    const x = dx * scale / radius;
    const y = dy * scale / radius;
    // Update the thumb directly; re-rendering all React HUD on every pointer
    // move causes compositor flashes/stutter on mobile WebGL surfaces.
    if (joystickThumbRef.current) {
      joystickThumbRef.current.style.transform = `translate(calc(-50% + ${x * 34}px), calc(-50% + ${y * 34}px))`;
    }
    gameRef.current?.setTouchMove(x, y);
  };

  const releaseStick = () => {
    if (joystickThumbRef.current) joystickThumbRef.current.style.transform = 'translate(-50%, -50%)';
    gameRef.current?.setTouchMove(0, 0);
  };

  const togglePerformance = () => {
    const next = !showPerformance;
    setShowPerformance(next);
    gameRef.current?.setPerformanceMonitor(next ? setPerformanceSample : undefined);
    if (!next) setPerformanceSample(undefined);
  };

  const chooseControlMode = (next: ControlPreference) => {
    // Changing modes mid-play must not leave the avatar walking or sprinting.
    releaseStick();
    runActiveRef.current = false;
    setRunActive(false);
    gameRef.current?.setTouchRun(false);
    setControlPreference(next);
    try { window.localStorage.setItem(CONTROL_MODE_KEY, next); }
    catch { /* Storage-disabled browsers retain the choice for this session. */ }
  };

  // RUN is toggleable on touch, leaving a finger free to jump while steering.
  const toggleRun = () => {
    const next = !runActiveRef.current;
    runActiveRef.current = next;
    setRunActive(next);
    gameRef.current?.setTouchRun(next);
  };

  const exportWorld = async () => {
    const game = gameRef.current;
    if (!game || exporting) return;
    setExporting(true);
    setExportNotice('Menyiapkan scene dan tekstur...');
    try {
      // Let React paint the busy state before serializing the scene.
      await new Promise<void>(resolve => window.setTimeout(resolve, 0));
      downloadWorldJSON(await game.exportWorldJSON());
      setExportNotice('File World JSON disiapkan.');
    } catch (reason) {
      console.error('[LembahAsri] World export failed', reason);
      setExportNotice('Export gagal: ' + (reason instanceof Error ? reason.message : String(reason)));
    } finally { setExporting(false); }
  };

  return <main className="game-shell" data-control-mode={controlMode}>
    <div className="game-canvas" ref={host} />
    <header className="brand"><span className="brand-mark">LA</span><div><strong>Lembah Asri</strong><small>RUMAH MASA KECIL · PLAYABLE 0.2</small></div></header>
    {!farm && <section className="objective"><b>Kembali ke Lembah Asri</b><span>Jelajahi rumah masa kecil</span><span>Dekati bedeng untuk berkebun</span><span>Ikuti jalan menuju desa</span>{ready && <a href="?bab=pulang">Mainkan bab Pulang ke Rumah</a>}</section>}
    {farm && <section className="farm-panel" aria-label="Rawat kebun">
      <div className="farm-location">{farm.chapter && <>Hari {farm.chapter.day} · {farm.chapter.location} </>}
        {farm.id >= 0 && <>Bedeng {farm.row} · Titik {farm.spot}</>}</div>
      {farm.chapter && <>
        <small>Benih {farm.chapter.seeds} · Air {farm.chapter.water}/4 · Panen {farm.harvests}</small>
        {farm.chapter.task && <div className="farm-actions"><button type="button"
          onClick={() => gameRef.current?.interactChapter(farm.chapter?.task)}>{farm.chapter.label} <kbd>E</kbd></button></div>}
      </>}
      <strong aria-live="polite">{farm.description}</strong>
      {farm.actions.length > 0 && <div className="farm-actions">
        {farm.actions.map(action => <button type="button" key={action}
          onClick={() => gameRef.current?.useFarmAction(action, farm.id)}>
          {farm.chapter && action === 'sow' ? 'Tanam kangkung' : farmLabels[action]} <kbd aria-hidden="true">{farmKeys.indexOf(action) + 1}</kbd>
        </button>)}
      </div>}
      {!farm.chapter && farm.harvests > 0 && <small>Hasil panen · {farm.harvests} sawi</small>}
      {farm.chapter && farm.id >= 0 && <small>{farm.chapter.goal}</small>}
      {!farm.saved && <small>Progres tersimpan selama sesi ini.</small>}
    </section>}
    <aside className="status">
      <span>☀ Musim Kemarau</span><strong>08:20</strong>
      <small>{ready ? '3D WORLD READY' : error ? 'ENGINE ERROR' : 'LOADING 3D CHARACTER'}</small>
      <div className="control-mode-picker">
        <label htmlFor="lembah-control-mode">Kontrol</label>
        <select id="lembah-control-mode" aria-label="Mode kontrol"
          value={controlPreference}
          onChange={event => chooseControlMode(event.currentTarget.value as ControlPreference)}>
          <option value="auto">Otomatis</option>
          <option value="desktop">Desktop</option>
          <option value="tablet">Tablet</option>
        </select>
      </div>
      {ready && <button type="button" className="perf-toggle" disabled={exporting}
        onClick={() => void exportWorld()} title="Unduh scene visual untuk Three.js Editor">
        {exporting ? 'Exporting...' : 'Export World JSON'}
      </button>}
      {exportNotice && <small role="status" className="perf-reading">{exportNotice}</small>}
      <button
        type="button" className="perf-toggle" aria-pressed={showPerformance}
        onClick={togglePerformance} title="Tampilkan FPS untuk pemeriksaan performa"
      >{showPerformance ? 'FPS ON' : 'FPS'}</button>
      {showPerformance && performanceSample &&
        <small className="perf-reading">{performanceSample.fps} FPS · {performanceSample.drawCalls} draw · {performanceSample.triangles.toLocaleString('id-ID')} tris</small>}
    </aside>
    {error && <div className="error">{error}</div>}
    <footer className="controls"><b>WASD</b> Bergerak <b>Mouse</b> Putar kamera <b>Shift</b> Lari <b>Space</b> Lompat</footer>
    <div className="mobile-joystick" ref={joystickRef}
      onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); moveStick(event); }}
      onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) moveStick(event); }}
      onPointerUp={releaseStick} onPointerCancel={releaseStick} onLostPointerCapture={releaseStick}
      aria-label="Joystick untuk bergerak">
      <div className="joystick-ring"><span className="joystick-direction up">▲</span><span className="joystick-direction down">▼</span><span className="joystick-direction left">◀</span><span className="joystick-direction right">▶</span>
        <div className="joystick-thumb" ref={joystickThumbRef} />
      </div>
    </div>
    <button
      type="button"
      className={`mobile-run${runActive ? ' is-running' : ''}`}
      aria-label={runActive ? 'Matikan lari' : 'Aktifkan lari'}
      aria-pressed={runActive}
      onPointerDown={event => { event.preventDefault(); toggleRun(); }}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) toggleRun();
        }
      }}
    >RUN</button>
    <button
      type="button"
      className="mobile-jump"
      aria-label="Lompat"
      onPointerDown={event => { event.preventDefault(); gameRef.current?.triggerJump(); }}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) gameRef.current?.triggerJump();
        }
      }}
    >JUMP</button>
    <div className="crosshair">＋</div>
  </main>;
}
