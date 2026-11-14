import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Game } from '../world/Game';

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game>();
  const joystickRef = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!host.current) return;
    let game: Game | undefined;
    let active = true;
    Game.create(host.current).then(instance => {
      if (!active) { instance.dispose(); return; }
      game = instance;
      gameRef.current = instance;
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
    setStick({ x: x * 34, y: y * 34 });
    gameRef.current?.setTouchMove(x, y);
  };

  const releaseStick = () => {
    setStick({ x: 0, y: 0 });
    gameRef.current?.setTouchMove(0, 0);
  };

  return <main className="game-shell">
    <div className="game-canvas" ref={host} />
    <header className="brand"><span className="brand-mark">LA</span><div><strong>Lembah Asri</strong><small>THREE.JS FOUNDATION · LEVEL 01</small></div></header>
    <section className="objective"><b>Tujuan Hari Ini</b><span>Jelajahi halaman desa</span><span>Temui warga sekitar</span></section>
    <aside className="status"><span>☀ Musim Kemarau</span><strong>08:20</strong><small>{ready ? '3D WORLD READY' : error ? 'ENGINE ERROR' : 'LOADING 3D CHARACTER'}</small></aside>
    {error && <div className="error">{error}</div>}
    <footer className="controls"><b>WASD</b> Bergerak <b>Mouse</b> Putar kamera <b>Shift</b> Lari <b>Space</b> Lompat</footer>
    <div className="mobile-joystick" ref={joystickRef}
      onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); moveStick(event); }}
      onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) moveStick(event); }}
      onPointerUp={releaseStick} onPointerCancel={releaseStick} onLostPointerCapture={releaseStick}
      aria-label="Joystick untuk bergerak">
      <div className="joystick-ring"><span className="joystick-direction up">▲</span><span className="joystick-direction down">▼</span><span className="joystick-direction left">◀</span><span className="joystick-direction right">▶</span>
        <div className="joystick-thumb" style={{ transform: `translate(calc(-50% + ${stick.x}px), calc(-50% + ${stick.y}px))` }} />
      </div>
    </div>
    <button className="mobile-jump" onPointerDown={event => event.preventDefault()} onClick={() => gameRef.current?.triggerJump()} aria-label="Lompat">JUMP</button>
    <div className="crosshair">＋</div>
  </main>;
}
