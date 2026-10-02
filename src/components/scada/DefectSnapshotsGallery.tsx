import React, { useState } from 'react';
import type { DefectSnapshotRecord } from '../../types/scada';
import { 
  Download, 
  Eye, 
  AlertTriangle, 
  X, 
  Layers, 
  Camera 
} from 'lucide-react';

interface DefectSnapshotsGalleryProps {
  defects: DefectSnapshotRecord[];
  compact?: boolean;
}

export const DefectSnapshotsGallery: React.FC<DefectSnapshotsGalleryProps> = ({
  defects,
  compact = false
}) => {
  const [selectedSnapshot, setSelectedSnapshot] = useState<DefectSnapshotRecord | null>(null);
  const [viewMode, setViewMode] = useState<'ANNOTATED' | 'RAW'>('ANNOTATED');

  // Download a single snapshot as PNG
  const handleDownload = (snapshot: DefectSnapshotRecord, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const link = document.createElement('a');
    link.download = `DEFECT_${snapshot.serialNumber}_${snapshot.defectType}_${snapshot.timestampMs}.png`;
    link.href = viewMode === 'RAW' && selectedSnapshot?.id === snapshot.id 
      ? snapshot.rawImageUrl 
      : snapshot.annotatedImageUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Fixed 3 slots (1, 2, 3)
  const slots: (DefectSnapshotRecord | null)[] = [
    defects[0] || null,
    defects[1] || null,
    defects[2] || null
  ];

  return (
    <div className="bg-white border border-slate-300 rounded-md p-2.5 flex flex-col gap-2 font-sans shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
        <div className="flex items-center gap-1.5">
          <div className="p-1 rounded bg-rose-100 border border-rose-300 text-rose-700">
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <span>Last 3 Defect Captures</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 font-bold border border-rose-300">
                {defects.length}/3
              </span>
            </div>
            {!compact && (
              <div className="text-[10px] text-slate-500 font-mono">
                OpenCV Two-Stage Inspection (Workpiece + Defect)
              </div>
            )}
          </div>
        </div>

        {defects.length > 0 && (
          <div className="text-[10px] text-slate-500 font-mono">
            Downloadable PNG
          </div>
        )}
      </div>

      {/* 3 Slots Grid */}
      <div className={`grid ${compact ? 'grid-cols-3 gap-1.5' : 'grid-cols-1 md:grid-cols-3 gap-2'}`}>
        {slots.map((item, idx) => {
          if (!item) {
            return (
              <div
                key={`empty-slot-${idx}`}
                className="border border-dashed border-slate-300 rounded bg-slate-50/80 p-2 flex flex-col items-center justify-center text-center min-h-[110px]"
              >
                <div className="w-7 h-7 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-400 mb-1">
                  <Camera className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-mono font-bold text-slate-500">
                  SLOT #{idx + 1}: EMPTY
                </span>
                <span className="text-[9px] text-slate-400 mt-0.5 max-w-[120px]">
                  Awaiting defective workpiece...
                </span>
              </div>
            );
          }

          return (
            <div
              key={item.id}
              onClick={() => {
                setSelectedSnapshot(item);
                setViewMode('ANNOTATED');
              }}
              className="group border border-rose-300 hover:border-rose-500 bg-rose-50/40 rounded p-1.5 flex flex-col gap-1.5 cursor-pointer transition-all hover:shadow-xs relative overflow-hidden"
            >
              {/* Slot Badge */}
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="font-bold text-rose-800 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                  #{idx + 1} {item.serialNumber}
                </span>
                <span className="text-[9px] text-slate-500">{item.timestamp}</span>
              </div>

              {/* Image Preview with overlay indicators */}
              <div className="relative aspect-square w-full rounded overflow-hidden border border-slate-300 bg-slate-950 flex items-center justify-center">
                <img
                  src={item.annotatedImageUrl}
                  alt={`Defect ${item.serialNumber}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />

                {/* Hover overlay hint */}
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <span className="p-1 rounded bg-white/90 text-slate-900 text-xs shadow-xs" title="Enlarge / Inspect">
                    <Eye className="w-3.5 h-3.5" />
                  </span>
                </div>

                {/* Defect Type Pill */}
                <div className="absolute bottom-1 left-1 pointer-events-none">
                  <span className="text-[9px] font-bold font-mono px-1 py-0.2 rounded bg-rose-600 text-white shadow-xs">
                    {item.defectType}
                  </span>
                </div>
              </div>

              {/* Detection Coordinates Strip */}
              <div className="text-[9px] font-mono text-slate-600 flex flex-col gap-0.5 bg-white/80 p-1 rounded border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-cyan-700 font-semibold">[1] Part:</span>
                  <span>{item.partBox.width}x{item.partBox.height}px</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-rose-700 font-semibold">[2] Defect:</span>
                  <span>{item.defectBox.area}px² ({item.defectBox.width}x{item.defectBox.height})</span>
                </div>
              </div>

              {/* Download Action Button */}
              <button
                onClick={(e) => handleDownload(item, e)}
                title="Download Inspection Image (PNG)"
                className="w-full py-1 px-2 rounded bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-mono font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
              >
                <Download className="w-3 h-3" />
                <span>Download Image</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Full Inspection Modal */}
      {selectedSnapshot && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setSelectedSnapshot(null)}
        >
          <div 
            className="bg-white border border-slate-300 rounded-lg max-w-2xl w-full flex flex-col overflow-hidden shadow-2xl font-sans"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-3 border-b border-slate-200 bg-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-rose-100 text-rose-700 border border-rose-300">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 font-mono">
                    DEFECT INSPECTION REPORT • {selectedSnapshot.serialNumber}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Time: {selectedSnapshot.timestamp}  |  Latency: {selectedSnapshot.latencyMs}ms  |  Engine: {selectedSnapshot.engineUsed}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedSnapshot(null)}
                className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 flex flex-col md:flex-row gap-4">
              {/* Image Viewport */}
              <div className="flex-1 flex flex-col gap-2">
                <div className="relative aspect-square w-full rounded border-2 border-slate-400 bg-slate-950 overflow-hidden shadow-inner flex items-center justify-center">
                  <img
                    src={viewMode === 'ANNOTATED' ? selectedSnapshot.annotatedImageUrl : selectedSnapshot.rawImageUrl}
                    alt="Defect Inspection View"
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* View Mode Toggle */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded border border-slate-300 text-xs font-mono">
                  <button
                    onClick={() => setViewMode('ANNOTATED')}
                    className={`py-1 rounded text-center font-bold transition-all flex items-center justify-center gap-1.5 ${
                      viewMode === 'ANNOTATED'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>OpenCV Analyzed</span>
                  </button>
                  <button
                    onClick={() => setViewMode('RAW')}
                    className={`py-1 rounded text-center font-bold transition-all flex items-center justify-center gap-1.5 ${
                      viewMode === 'RAW'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Raw Sensor Frame</span>
                  </button>
                </div>
              </div>

              {/* Analysis Sidebar */}
              <div className="w-full md:w-64 flex flex-col gap-3 font-mono text-xs">
                {/* Stage 1 Card */}
                <div className="p-2.5 rounded border border-cyan-300 bg-cyan-50/50 flex flex-col gap-1">
                  <span className="font-bold text-cyan-900 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-cyan-500" />
                    <span>STAGE 1: WORKPIECE LOCALIZATION</span>
                  </span>
                  <div className="text-[11px] text-slate-700 flex flex-col gap-0.5 mt-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Coordinates (X, Y):</span>
                      <span className="font-semibold">{selectedSnapshot.partBox.x}, {selectedSnapshot.partBox.y}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Dimensions (W x H):</span>
                      <span className="font-semibold">{selectedSnapshot.partBox.width} x {selectedSnapshot.partBox.height} px</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Surface Area:</span>
                      <span className="font-semibold">{selectedSnapshot.partBox.area} px²</span>
                    </div>
                  </div>
                </div>

                {/* Stage 2 Card */}
                <div className="p-2.5 rounded border border-rose-300 bg-rose-50/50 flex flex-col gap-1">
                  <span className="font-bold text-rose-900 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-600" />
                    <span>STAGE 2: DEFECT LOCALIZATION</span>
                  </span>
                  <div className="text-[11px] text-slate-700 flex flex-col gap-0.5 mt-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Defect Class:</span>
                      <span className="font-bold text-rose-700">{selectedSnapshot.defectType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Defect Coordinates:</span>
                      <span className="font-semibold">{selectedSnapshot.defectBox.x}, {selectedSnapshot.defectBox.y}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">BBox (W x H):</span>
                      <span className="font-semibold">{selectedSnapshot.defectBox.width} x {selectedSnapshot.defectBox.height} px</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Defect Area:</span>
                      <span className="font-semibold">{selectedSnapshot.defectBox.area} px²</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Severity Rating:</span>
                      <span className="font-bold text-rose-600">{selectedSnapshot.severity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Confidence:</span>
                      <span className="font-semibold text-emerald-700">{(selectedSnapshot.confidence * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                {/* Direct Download Button */}
                <button
                  onClick={() => handleDownload(selectedSnapshot)}
                  className="mt-auto w-full py-2 px-3 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Image (PNG)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
