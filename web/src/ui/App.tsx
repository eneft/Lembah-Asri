import { useEffect, useRef, useState } from 'react';
import { Game } from '../world/Game';

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!host.current) return;
    let game: Game | undefined;
    let active = true;
    Game.create(host.current).then(instance => {
      if (!active) { instance.dispose(); return; }
      game = instance;
      setReady(true);
    }).catch(reason => setError(String(reason)));
    return () => { active = false; game?.dispose(); };
  }, []);

  return <main className="game-shell">
    <div className="game-canvas" ref={host} />
    <header className="brand"><span className="brand-mark">LA</span><div><strong>Lembah Asri</strong><small>THREE.JS FOUNDATION · LEVEL 01</small></div></header>
    <section className="objective"><b>Tujuan Hari Ini</b><span>Jelajahi halaman desa</span><span>Temui warga sekitar</span></section>
    <aside className="status"><span>☀ Musim Kemarau</span><strong>08:20</strong><small>{ready ? '3D WORLD READY' : error ? 'ENGINE ERROR' : 'INITIALIZING 3D WORLD'}</small></aside>
    {error && <div className="error">{error}</div>}
    <footer className="controls"><b>WASD</b> Bergerak <b>Mouse</b> Putar kamera <b>Shift</b> Lari</footer>
    <div className="crosshair">＋</div>
  </main>;
}