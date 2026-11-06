/** Non-persistent selected-wall dimensions; commits use existing model transform
 * and permanent dimensions use existing drafting.addDimension associations.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { NodeDto, RenderItem } from '../engine/protocol';
import type { Vec2 } from '../platform/module';
import { execute, useSession } from '../engine/session';
import { dimensionMove, wallFaceDimensions, type FaceDimension } from './temporaryDimensions';
import { parseLength } from '../engine/unitsStore';

type Screen = (p: Vec2) => Vec2;

export function TemporaryDimensionOverlay({ selected, items, nodes, toScreen, viewId, disabled }: {
  selected: string[];
  items: RenderItem[];
  nodes: Map<string, NodeDto>;
  toScreen: Screen;
  viewId: string | null;
  disabled: boolean;
}) {
  const id = !disabled && selected.length === 1 ? selected[0] : null;
  const candidates = useMemo(() => id ? wallFaceDimensions(id, items, nodes) : [], [id, items, nodes]);
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [pinned, setPinned] = useState<string[]>([]);
  const busy = useRef(new Set<string>());
  useEffect(() => { setEditing(null); setPinned([]); busy.current.clear(); }, [id, viewId]);
  const key = (d: FaceDimension) => [viewId, d.selected, d.reference, d.side].join(':');
  const isPermanent = (d: FaceDimension) => [...nodes.values()].some((node) => {
    if (node.props.predefinedType !== 'DIMENSION' || node.props.viewId !== viewId) return false;
    const refs = node.props.refs;
    const pts = node.props.pts;
    if (!Array.isArray(refs) || !Array.isArray(pts) || refs.length !== 2 || pts.length !== 2) return false;
    const ids = refs.map((ref) => ref && typeof ref === 'object' && !Array.isArray(ref) ? ref.element : null);
    if (!ids.includes(d.selected) || !ids.includes(d.reference)) return false;
    return pts.some((point) => Array.isArray(point) && point.length >= 2 &&
      Math.hypot(Number(point[0]) - d.a.x, Number(point[1]) - d.a.y) < 0.03);
  });
  const commit = async (d: FaceDimension) => {
    const target = parseLength(value, 'm');
    setEditing(null);
    const by = target == null ? null : dimensionMove(d, target);
    if (!by || Math.hypot(by.x, by.y) < 1e-9) return;
    // Command handles constraints, joins, hosted elements, Undo/Redo.
    try { await execute('element.transform', { ids: [d.selected], op: 'move', by: [by.x, by.y] }); }
    catch { useSession.setState({ error: 'The requested distance conflicts with the element constraints.' }); }
  };
  const pin = async (d: FaceDimension) => {
    if (!viewId) return;
    const k = key(d);
    if (busy.current.has(k) || pinned.includes(k) || isPermanent(d)) return;
    busy.current.add(k);
    try {
      const mid = { x: (d.a.x + d.b.x) / 2, y: (d.a.y + d.b.y) / 2 };
      // Engine associator captures stable face references and owns the permanent dimension.
      const result = await execute('drafting.addDimension', { viewId, a: [d.a.x, d.a.y], b: [d.b.x, d.b.y], at: [mid.x, mid.y], dir: [d.normal.x, d.normal.y] });
      if (result) setPinned((v) => [...v, k]);
    } finally { busy.current.delete(k); }
  };
  if (!id || !viewId || !candidates.length) return null;
  return <g className="temporary-dimensions" aria-label="Temporary dimensions">
    {candidates.map((d) => {
      const k = key(d);
      if (pinned.includes(k) || isPermanent(d)) return null;
      const a = toScreen(d.a), b = toScreen(d.b);
      const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
      const editingThis = editing === k;
      return <g key={k}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#20a7c9" strokeWidth={1.15} pointerEvents="none" />
        {[a, b].map((p, i) => <line key={i} x1={p.x - 4} y1={p.y - 4} x2={p.x + 4} y2={p.y + 4} stroke="#20a7c9" strokeWidth={1.3} pointerEvents="none" />)}
        <foreignObject x={x - 70} y={y - 21} width={140} height={62} style={{ overflow: 'visible' }}
          onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', flexDirection: 'column', gap: 2 }}>
            {editingThis
              ? <input autoFocus type="text" inputMode="decimal" value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') void commit(d); if (e.key === 'Escape') setEditing(null); }}
                  style={{ width: 92, height: 25, textAlign: 'center', color: 'var(--text, #222)', background: 'var(--panel, #fff)' }} />
              : <button type="button" title="Edit measured distance" onClick={() => { setValue(d.distance.toFixed(3)); setEditing(k); }}
                  style={{ fontSize: 12, cursor: 'text', padding: '2px 7px', borderRadius: 4, border: '1px solid #20a7c9', background: 'var(--panel, #fff)', color: 'var(--text, #222)' }}>
                  {d.distance.toFixed(2)} m
                </button>}
            <button type="button" title="Pin as permanent view dimension" aria-label="Pin dimension"
              onClick={() => void pin(d)}
              style={{ fontSize: 12, minWidth: 34, height: 22, padding: '0 7px', borderRadius: 5, background: 'var(--panel, #fff)', color: '#20a7c9', border: '1px solid #20a7c9' }}>
              ⌖
            </button>
          </div>
        </foreignObject>
      </g>;
    })}
  </g>;
}
