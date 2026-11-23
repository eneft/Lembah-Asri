import { useRef, useState } from 'react';
import type { Game } from '../world/Game';
import type { EditorTool, SceneEditorSnapshot } from '../world/SceneVisualEditor';
import './sceneEditor.css';

type Props = {
  game: Game;
  snapshot: SceneEditorSnapshot;
  onClose: () => void;
};

const AXES = ['X', 'Y', 'Z'] as const;
const KINDS = [
  { key: 'position', label: 'Posisi (meter)' },
  { key: 'rotation', label: 'Rotasi (derajat)' },
  { key: 'scale', label: 'Ukuran (skala)' }
] as const;

export default function SceneEditorPanel({ game, snapshot, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedInfo = snapshot.items.find(item => item.id === snapshot.selectedId);
  const filtered = snapshot.items.filter(item => (item.label + ' ' + item.group)
    .toLocaleLowerCase('id-ID').includes(search.toLocaleLowerCase('id-ID')));

  const downloadLayout = () => {
    const content = game.exportSceneLayout();
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'lembah-asri-scene-layout.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setNotice('Layout JSON berhasil diekspor. Commit file ini ke GitHub agar berlaku untuk semua perangkat.');
  };
  const readLayout = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 750_000) throw new Error('File terlalu besar (maksimum 750 KB)');
      game.importSceneLayout(await file.text());
      setNotice('Layout berhasil dimuat dan disimpan pada browser ini.');
    } catch (error) {
      setNotice('Gagal impor: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return <section className="scene-editor" aria-label="Editor visual scene Lembah Asri">
    <div className="scene-editor-header">
      <div><strong>Editor Scene</strong><small>Three.js · Tata letak visual</small></div>
      <button className="scene-editor-close" type="button" onClick={onClose}>Selesai ✕</button>
    </div>
    <div className="scene-editor-tools" aria-label="Alat transformasi">
      {([
        ['translate', 'Pindah'],
        ['rotate', 'Putar'],
        ['scale', 'Skala']
      ] as const).map(([mode, label]) => <button type="button" key={mode}
        aria-pressed={snapshot.mode === mode}
        className={snapshot.mode === mode ? 'is-active' : ''}
        onClick={() => game.setSceneEditTool(mode as EditorTool)}>{label}</button>)}
    </div>
    <p className="scene-editor-hint">Klik objek 3D atau pilih dari daftar. Geser gizmo untuk mengubah posisi, putaran, atau ukuran. Drag area kosong untuk memutar kamera; scroll untuk zoom.</p>
    <label className="scene-editor-search-label" htmlFor="scene-object-search">Objek scene ({snapshot.items.length})</label>
    <input id="scene-object-search" className="scene-editor-search" value={search}
      onChange={event => setSearch(event.currentTarget.value)}
      placeholder="Cari pohon, batu, sumur..." />
    <div className="scene-editor-list" role="list" aria-label="Daftar objek scene">
      {filtered.map(item => <button type="button" role="listitem" key={item.id}
        className={snapshot.selectedId === item.id ? 'is-selected' : ''}
        onClick={() => game.selectSceneObject(item.id)}
        title={item.locked ? 'Objek sistem atau berkolisi (hanya lihat)' : item.group}>
        <span>{item.label}</span>{item.locked && <span className="scene-editor-lock">Terkunci</span>}
      </button>)}
      {filtered.length === 0 && <p className="scene-editor-empty">Objek tidak ditemukan.</p>}
    </div>
    <div className="scene-editor-inspector">
      <div className="scene-editor-inspector-title">
        <b>{selectedInfo?.label || 'Belum memilih objek'}</b>
        {selectedInfo && <button type="button" onClick={() => game.focusSceneObject()}>Fokus kamera</button>}
      </div>
      {snapshot.selected && selectedInfo && <div className="scene-editor-values">
        {KINDS.map(kind => <div className="scene-editor-transform-row" key={kind.key}>
          <span>{kind.label}</span>
          <div className="scene-editor-axes">
            {AXES.map((axis, index) => {
              const raw = snapshot.selected![kind.key][index];
              const rendered = kind.key === 'rotation' ? THREE_RAD_TO_DEG(raw) : raw;
              return <label key={axis}>{axis}<input aria-label={kind.label + ' ' + axis}
                type="number" step={kind.key === 'scale' ? '0.05' : '0.1'}
                value={Number(rendered.toFixed(3))}
                onChange={event => {
                  const value = Number(event.currentTarget.value);
                  if (!Number.isFinite(value)) return;
                  game.setSceneObjectComponent(kind.key, index,
                    kind.key === 'rotation' ? value * Math.PI / 180 : value);
                }} /></label>;
            })}
          </div>
        </div>)}
        <button type="button" className="scene-editor-reset-selected"
          onClick={() => game.resetSceneObject()}>Kembalikan objek ini</button>
      </div>}
      <p aria-live="polite">{snapshot.message}</p>
    </div>
    <div className="scene-editor-files">
      <button type="button" onClick={downloadLayout}>Ekspor JSON</button>
      <button type="button" onClick={() => inputRef.current?.click()}>Impor JSON</button>
      <input type="file" ref={inputRef} accept=".json,application/json" hidden
        onChange={event => void readLayout(event.currentTarget.files?.[0])} />
      <button type="button" className="scene-editor-reset"
        onClick={() => {
          if (window.confirm('Kembalikan semua perubahan posisi objek?')) {
            game.clearSceneLayout();
            setNotice('Semua perubahan layout lokal dikembalikan.');
          }
        }}>Reset semua</button>
    </div>
    {notice && <p className="scene-editor-notice" role="status">{notice}</p>}
    <p className="scene-editor-warning">Perubahan tersimpan otomatis di browser ini. Ekspor JSON untuk dibawa ke GitHub. Terrain, sungai, jembatan, rumah, pagar, dan objek gameplay dikunci agar collider/farming tidak rusak.</p>
  </section>;
}

function THREE_RAD_TO_DEG(rad: number) { return rad * 180 / Math.PI; }
