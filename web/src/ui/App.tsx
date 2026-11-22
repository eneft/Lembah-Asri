import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Game, type PerformanceStats } from '../world/Game';

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game>();
  const joystickRef = useRef<HTMLDivElement>(null);
  const joystickThumbRef = useRef<HTMLDivElement>(null);
  const runActiveRef = useRef(false);
  const [runActive, setRunActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [showPerformance, setShowPerformance] = useState(false);
  const [performanceSample, setPerformanceSample] = useState<PerformanceStats>();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!host.current) return;
    let game: Game | undefined;
    let active = true;
    Game.create(host.current).then(instance => {
      if (!active) { instance.dispose(); return; }
      game = instance;
      gameRef.current = instance;
      instance.setTouchRun(runActiveRef.current);
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

  // RUN is toggleable on touch, leaving a finger free to jump while steering.
  const toggleRun = () => {
    const next = !runActiveRef.current;
    runActiveRef.current = next;
    setRunActive(next);
    gameRef.current?.setTouchRun(next);
  };

  return <main className="game-shell">
    <div className="game-canvas" ref={host} />
    <header className="brand"><span className="brand-mark">LA</span><div><strong>Lembah Asri</strong><small>RUMAH MASA KECIL · PLAYABLE 0.2</small></div></header>
    <section className="objective"><b>Kembali ke Lembah Asri</b><span>Jelajahi rumah masa kecil</span><span>Jelajahi kebun sayur rumah</span><span>Ikuti jalan menuju desa</span></section>
    <aside className="status">
      <span>☀ Musim Kemarau</span><strong>08:20</strong>
      <small>{ready ? '3D WORLD READY' : error ? 'ENGINE ERROR' : 'LOADING 3D CHARACTER'}</small>
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
