import { X } from 'lucide-react';
import type { Message, Village } from './model';
import { riskLabels } from './model';
import './village-popover.css';

export interface VillagePopoverProps {
  village: Village;
  pendingCount: number;
  lastReply?: Message;
  mode: 'live' | 'replay';
  headingId: string;
  onClose: () => void;
  onOpenDetails: () => void;
  integrated?: boolean;
}

export function placeVillagePopover(
  anchor: { x: number; y: number },
  bounds: { width: number; height: number },
  card: { width: number; height: number },
): { left: number; top: number } {
  const width = Math.max(0, bounds.width);
  const height = Math.max(0, bounds.height);
  const gutterX = Math.min(12, width / 2);
  const gutterY = Math.min(12, height / 2);
  const cardWidth = Math.min(Math.max(0, card.width), width - gutterX * 2);
  const cardHeight = Math.min(Math.max(0, card.height), height - gutterY * 2);
  const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
  const above = anchor.y - cardHeight - 28;
  return {
    left: clamp(anchor.x - cardWidth / 2, gutterX, width - cardWidth - gutterX),
    top: clamp(above >= gutterY ? above : anchor.y + 28, gutterY, height - cardHeight - gutterY),
  };
}

export default function VillagePopoverContent({ village, pendingCount, lastReply, mode, headingId, onClose, onOpenDetails, integrated = false }: VillagePopoverProps) {
  const critical = village.criticalIn;
  const countdown = critical == null || !Number.isFinite(critical)
    ? 'Perkiraan waktu kritis belum tersedia.'
    : critical <= 0 ? 'Kondisi kritis hari ini.' : `Perkiraan kritis dalam ${critical} hari.`;
  const confidence = village.confidence;
  return <div className="village-popover-content">
    <header className="village-popover-header"><div><h3 id={headingId}>Desa {village.name}</h3><p>{village.district ? `Kecamatan ${village.district}` : 'Kecamatan belum tersedia'}</p></div><button className="village-popover-close" aria-label="Tutup ringkasan desa" onClick={onClose}><X size={18} aria-hidden="true" /></button></header>
    <div className="village-popover-risk"><span>Risiko {mode === 'replay' ? 'replay' : integrated ? 'model' : 'demo'}</span><span className={`map-selection-risk risk-${village.risk}`}>{riskLabels[village.risk]}</span></div>
    <p className="village-popover-countdown">{countdown}</p>
    <p className="village-popover-benefit">{village.extraDays != null && village.extraDays > 0 ? <>Sekat kanal: <strong>+{village.extraDays} hari {integrated ? 'tambahan menurut model' : 'aman'}</strong></> : village.extraDays === 0 && integrated ? 'Sekat kanal: tambahan waktu menurut model 0 hari.' : 'Manfaat sekat kanal belum tersedia.'}</p>
    <dl className="village-popover-facts"><div><dt>Usulan menunggu</dt><dd>{pendingCount}</dd></div><div><dt>Balasan terakhir</dt><dd>{lastReply?.time ?? 'Belum ada'}</dd></div>{confidence != null && Number.isFinite(confidence) && <div><dt>Keyakinan model</dt><dd>{Math.round(confidence * 100)}%</dd></div>}</dl>
    <div className="village-popover-provenance"><p>{integrated ? 'Estimasi model · bukan pengukuran lapangan' : 'Model demo · belum diukur'}</p>{mode === 'replay' && <p>{integrated ? 'Risiko dari replay. Usulan dan balasan: sesi operator saat ini.' : 'Risiko dari replay. Usulan dan balasan: sesi demo saat ini.'}</p>}</div>
    <button className="village-popover-open" onClick={onOpenDetails}>Buka detail desa</button>
  </div>;
}
