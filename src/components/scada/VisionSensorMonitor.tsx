import React, { useRef, useEffect, useState } from 'react';
import { 
  IndustrialVisionSensor, 
  type SensorTelemetry 
} from '../../core/sensor/IndustrialVisionSensor';
import type { 
  VisionFilterMode, 
  InspectionResult, 
  SensorSettings 
} from '../../types/scada';
import { 
  Camera, 
  Crosshair, 
  Maximize2, 
  AlertCircle, 
  CheckCircle2,
  Layers,
  Sun
} from 'lucide-react';

interface VisionSensorMonitorProps {
  sensor: IndustrialVisionSensor | null;
  latestResult: InspectionResult | null;
  onMaximize?: () => void;
}

export const VisionSensorMonitor: React.FC<VisionSensorMonitorProps> = ({
  sensor,
  latestResult,
  onMaximize
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [telemetry, setTelemetry] = useState<SensorTelemetry | null>(() => sensor ? sensor.getTelemetry() : null);
  const [settings, setSettings] = useState<SensorSettings | null>(() => sensor ? sensor.getSettings() : null);

  useEffect(() => {
    if (!sensor) return;

    // Subscribe to high-speed sensor stream
    const unsubscribe = sensor.onFrame((displayCanvas, tel) => {
      setTelemetry({ ...tel });

      // Blit to DOM canvas
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.drawImage(displayCanvas, 0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [sensor]);

  const handleFilterChange = (mode: VisionFilterMode) => {
    if (sensor) {
      sensor.updateSettings({ filterMode: mode });
      setSettings(sensor.getSettings());
    }
  };

  const toggleOverlay = () => {
    if (sensor && settings) {
      const next = !settings.showOverlay;
      sensor.updateSettings({ showOverlay: next });
      setSettings(sensor.getSettings());
    }
  };

  const toggleCrosshair = () => {
    if (sensor && settings) {
      const next = !settings.showCrosshair;
      sensor.updateSettings({ showCrosshair: next });
      setSettings(sensor.getSettings());
    }
  };

  return (
    <div className="bg-white border border-slate-300 rounded-md p-2.5 flex flex-col gap-2.5 font-sans shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-sky-100 border border-sky-300 text-sky-800">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <span>Cam-01: Vision Inspector</span>
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Telecentric • 256x256 WASM Pipeline
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1 font-mono">
          <button
            onClick={toggleOverlay}
            title="Toggle OSD Overlay"
            className={`p-1 rounded text-xs transition-all ${
              settings?.showOverlay
                ? 'bg-sky-100 text-sky-800 border border-sky-300'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={toggleCrosshair}
            title="Toggle Reticle / Crosshair"
            className={`p-1 rounded text-xs transition-all ${
              settings?.showCrosshair
                ? 'bg-sky-100 text-sky-800 border border-sky-300'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
          {onMaximize && (
            <button
              onClick={onMaximize}
              title="Full-Screen Vision Station"
              className="p-1 rounded text-slate-500 hover:text-sky-800 hover:bg-slate-100 transition-all"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Sensor Canvas Container */}
      <div className="relative aspect-square w-full bg-slate-950 rounded overflow-hidden border border-slate-800 flex items-center justify-center group shadow-inner">
        <canvas
          ref={canvasRef}
          width={256}
          height={256}
          className="w-full h-full object-contain filter contrast-105"
        />

        {/* Physical Camera Sensor Watermark Corner Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 pointer-events-none font-mono">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-700/60 text-slate-300 backdrop-blur-sm">
            FPS: {telemetry?.fps ?? 30}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-700/60 text-slate-300 backdrop-blur-sm">
            TEMP: {telemetry?.sensorTempC ?? 38.5}°C
          </span>
        </div>

        <div className="absolute top-2 right-2 pointer-events-none font-mono">
          <span
            className={`text-[10px] px-2 py-0.5 rounded font-bold border backdrop-blur-sm ${
              telemetry?.triggerStatus === 'TRIGGERED'
                ? 'bg-amber-500/30 border-amber-500 text-amber-300 animate-pulse'
                : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400'
            }`}
          >
            {telemetry?.triggerStatus === 'TRIGGERED' ? 'PHOTOEYE TRIGGER' : 'OPTICAL ACQUIRE'}
          </span>
        </div>

        {/* Live Scanline FX overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent pointer-events-none opacity-40 animate-pulse" />
      </div>

      {/* Sensor Filter Mode Selector */}
      <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-100 rounded border border-slate-300 text-[10px] font-mono">
        {(['EDGE_INSPECTION', 'MONOCHROME', 'RAW_COLOR', 'BINARY_MASK'] as VisionFilterMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => handleFilterChange(mode)}
            className={`py-1 rounded text-center transition-all ${
              settings?.filterMode === mode
                ? 'bg-sky-600 text-white font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            {mode === 'EDGE_INSPECTION'
              ? 'ANALYZE'
              : mode === 'MONOCHROME'
              ? 'CMOS'
              : mode === 'RAW_COLOR'
              ? 'RGB'
              : 'MASK'}
          </button>
        ))}
      </div>

      {/* LED Spot Illumination Intensity */}
      <div className="flex items-center justify-between gap-2 px-1 text-[11px] text-slate-700 font-mono">
        <span className="flex items-center gap-1 text-slate-500">
          <Sun className="w-3.5 h-3.5 text-amber-500" />
          <span>LED Spot:</span>
        </span>
        <input
          type="range"
          min="0"
          max="100"
          value={settings?.ringLightIntensity ?? 85}
          onChange={e => {
            const val = parseInt(e.target.value);
            if (sensor) {
              sensor.updateSettings({ ringLightIntensity: val });
              setSettings(sensor.getSettings());
            }
          }}
          className="flex-1 accent-sky-600 bg-slate-200 rounded h-1 cursor-pointer"
        />
        <span className="w-8 text-right font-bold text-sky-800">
          {settings?.ringLightIntensity ?? 85}%
        </span>
      </div>

      {/* Latest Inspection Verdict Card */}
      {latestResult ? (
        <div
          className={`p-2.5 rounded border text-xs flex flex-col gap-1 transition-all ${
            latestResult.status === 'OK'
              ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
              : 'bg-rose-50 border-rose-400 text-rose-900 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between font-bold font-mono">
            <span className="flex items-center gap-1.5">
              {latestResult.status === 'OK' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-700 animate-bounce" />
              )}
              VERDICT: {latestResult.status === 'OK' ? 'PART PASSED' : 'DEFECT DETECTED'}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-normal">
              {latestResult.latencyMs} ms
            </span>
          </div>

          <div className="text-[11px] text-slate-700 flex justify-between font-mono">
            <span>SN: {latestResult.serialNumber}</span>
            <span>Engine: {latestResult.engineUsed}</span>
          </div>

          {latestResult.defectInfo && (
            <div className="mt-1 pt-1.5 border-t border-rose-300 text-[10px] grid grid-cols-2 gap-1 text-rose-900 font-mono">
              <div>Type: {latestResult.defectInfo.type}</div>
              <div>Area: {latestResult.defectInfo.area} px</div>
              <div>
                BBox: [{latestResult.defectInfo.x}, {latestResult.defectInfo.y},{' '}
                {latestResult.defectInfo.width}, {latestResult.defectInfo.height}]
              </div>
              <div>Severity: {latestResult.defectInfo.severity}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-2.5 rounded border border-slate-300 bg-slate-50 text-[11px] text-slate-500 text-center font-mono">
          Awaiting workpiece at Photoeye sensor...
        </div>
      )}
    </div>
  );
};
