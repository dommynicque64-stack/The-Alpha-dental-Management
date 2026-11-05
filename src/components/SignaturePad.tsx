import { useRef, useState, type PointerEvent } from 'react';
import { Btn } from './ui';

type Props = { value: string; onChange: (value: string) => void };
export default function SignaturePad({ value, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(Boolean(value));
  const [hasInk, setHasInk] = useState(false);
  const point = (e: PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX-r.left)*c.width/r.width, y: (e.clientY-r.top)*c.height/r.height };
  };
  const start = (e: PointerEvent<HTMLCanvasElement>) => {
    if (confirmed) return;
    const c=canvasRef.current!; c.setPointerCapture(e.pointerId); setHasInk(true);
    setUndoStack(s=>[...s.slice(-9),c.toDataURL()]);
    const p=point(e); const ctx=c.getContext('2d')!;
    ctx.beginPath(); ctx.moveTo(p.x,p.y); drawing.current=true;
  };
  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    if(!drawing.current || confirmed) return;
    const p=point(e); const ctx=canvasRef.current!.getContext('2d')!;
    ctx.lineWidth=3; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.strokeStyle='#172554';
    ctx.lineTo(p.x,p.y); ctx.stroke();
  };
  const end = () => { drawing.current=false; };
  const restore = (src:string) => { const c=canvasRef.current!; const ctx=c.getContext('2d')!; ctx.clearRect(0,0,c.width,c.height); if(src){const im=new Image();im.onload=()=>ctx.drawImage(im,0,0,c.width,c.height);im.src=src;} };
  const clear = () => { restore(''); setUndoStack([]); onChange(''); setConfirmed(false); };
  const undo = () => { const last=undoStack[undoStack.length-1]; if(last!==undefined){restore(last);setUndoStack(s=>s.slice(0,-1));} };
  const confirm = () => { const data=canvasRef.current!.toDataURL('image/png'); if(data.length<1800)return; onChange(data);setConfirmed(true); };
  return <div className="space-y-2">
    <canvas ref={canvasRef} width={900} height={240} className="w-full touch-none rounded-xl border border-slate-300 bg-white" style={{height:160}}
      onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} aria-label="Patient digital signature pad" />
    <div className="flex flex-wrap gap-2">
      <Btn type="button" variant="secondary" onClick={undo} disabled={confirmed || undoStack.length===0}>Undo</Btn>
      <Btn type="button" variant="secondary" onClick={clear}>Clear / redo</Btn>
      <Btn type="button" onClick={confirm} disabled={confirmed || !hasInk}>Confirm signature</Btn>
      {confirmed && <span className="self-center text-xs font-semibold text-emerald-700">Signature confirmed</span>}
    </div>
    <p className="text-xs text-slate-500">Sign using a finger, stylus or mouse, then confirm before registering.</p>
  </div>;
}
