import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  IndustrialVisionSensor, 
  type SensorTelemetry 
} from '../../core/sensor/IndustrialVisionSensor';
import type { 
  VisionFilterMode, 
  InspectionResult, 
  SensorSettings,
  DefectSnapshotRecord 
} from '../../types/scada';
import { DefectSnapshotsGallery } from './DefectSnapshotsGallery';
import { 
  Sliders, 
  Download, 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  Cpu,
  Sun 
} from 'lucide-react';

interface StandaloneVisionStationProps {
  sensor: IndustrialVisionSensor | null;
  latestResult: InspectionResult | null;
  recentDefects?: DefectSnapshotRecord[];
  onBackToTwin: () => void;
}

export const StandaloneVisionStation: React.FC<StandaloneVisionStationProps> = ({
  sensor,
  latestResult,
  recentDefects = [],
  onBackToTwin
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const histogramRef = useRef<HTMLCanvasElement | null>(null);
  const [telemetry, setTelemetry] = useState<SensorTelemetry | null>(() => sensor ? sensor.getTelemetry() : null);
  const [settings, setSettings] = useState<SensorSettings | null>(() => sensor ? sensor.getSettings() : null);

  const drawHistogram = useCallback((sensorCtx: CanvasRenderingContext2D) => {
    if (!histogramRef.current) return;
    const hCanvas = histogramRef.current;
    const hCtx = hCanvas.getContext('2d');
    if (!hCtx) return;

    const imgData = sensorCtx.getImageData(0, 0, 256, 256);
    const data = imgData.data;
    const bins = new Uint32Array(64);

    for (let i = 0; i < data.length; i += 16) {
      const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const binIdx = Math.min(63, Math.floor(luma / 4));
      bins[binIdx]++;
    }

    let maxBin = 1;
    for (let i = 0; i < 64; i++) {
      if (bins[i] > maxBin) maxBin = bins[i];
    }

    hCtx.clearRect(0, 0, hCanvas.width, hCanvas.height);
    const barWidth = hCanvas.width / 64;

    for (let i = 0; i < 64; i++) {
      const barHeight = (bins[i] / maxBin) * (hCanvas.height - 4);
      const intensity = i / 64;
      hCtx.fillStyle = `hsl(${190 + intensity * 40}, 80%, ${35 + intensity * 25}%)`;
      hCtx.fillRect(
        i * barWidth,
        hCanvas.height - barHeight,
        barWidth - 0.5,
        barHeight
      );
    }
  }, []);

  useEffect(() => {
    if (!sensor) return;

    const unsubscribe = sensor.onFrame((displayCanvas, tel) => {
      setTelemetry({ ...tel });

      // Draw main sensor display
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.drawImage(displayCanvas, 0, 0, canvasRef.current.width, canvasRef.current.height);
          // Render Live Pixel Luminance Histogram
          drawHistogram(ctx);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [sensor, drawHistogram]);

  const handleFilterChange = (mode: VisionFilterMode) => {
    if (sensor) {
      sensor.updateSettings({ filterMode: mode });
      setSettings(sensor.getSettings());
    }
  };

  const handleExposureChange = (val: number) => {
    if (sensor) {
      sensor.updateSettings({ exposureUs: val });
      setSettings(sensor.getSettings());
    }
  };

  const handleGainChange = (val: number) => {
    if (sensor) {
      sensor.updateSettings({ gain: val });
      setSettings(sensor.getSettings());
    }
  };

  const handleIlluminationChange = (val: number) => {
    if (sensor) {
      sensor.updateSettings({ ringLightIntensity: val });
      setSettings(sensor.getSettings());
    }
  };

  const downloadSnapshot = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `inspection_frame_${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="flex-1 bg-slate-100 flex flex-col font-sans text-slate-900 select-none overflow-hidden">
      {/* Station Top Bar */}
      <div className="h-11 border-b border-slate-300 bg-slate-200 px-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBackToTwin}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 border border-slate-300 transition-all shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-sky-700" />
            <span>Return to 3D Digital Twin</span>
          </button>
          <div className="h-3.5 w-px bg-slate-400" />
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-900 uppercase tracking-wider font-mono">
              Vision Station HMI 04
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 border border-sky-300 font-mono font-semibold">
              SMART SENSOR STREAM
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={downloadSnapshot}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 border border-slate-300 transition-all shadow-xs font-mono"
          >
            <Download className="w-3.5 h-3.5 text-sky-700" />
            <span>Export Frame (PNG)</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 p-3 gap-3 overflow-hidden">
        {/* Left 3 Columns: High-Resolution Camera Viewport */}
        <div className="lg:col-span-3 bg-slate-200/90 border border-slate-300 rounded-md p-3 flex flex-col items-center justify-center relative overflow-hidden shadow-xs">
          {/* Main Large Sensor Canvas */}
          <div className="relative aspect-square w-full max-w-[620px] max-h-[75vh] bg-black rounded overflow-hidden border-2 border-slate-400 shadow-md flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={512}
              height={512}
              className="w-full h-full object-contain filter contrast-105"
            />

            {/* Industrial Camera Overlay HUD */}
            <div className="absolute top-2.5 left-2.5 bg-slate-950/85 backdrop-blur-xs border border-slate-700 rounded p-2 text-[10px] font-mono flex flex-col gap-0.5 text-slate-300">
              <div className="text-sky-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>ONLINE: OPENCV WASM ENGINE</span>
              </div>
              <div>RESOLUTION: 256 x 256 px Telecentric</div>
              <div>SHUTTER: Global Electronic CMOS</div>
              <div>TRIGGER: Photoeye Optical Barrier</div>
            </div>

            <div className="absolute top-2.5 right-2.5 bg-slate-950/85 backdrop-blur-xs border border-slate-700 rounded p-2 text-[10px] font-mono flex flex-col items-end gap-0.5">
              <span className="text-amber-400 font-bold">
                EXP: {settings?.exposureUs} µs
              </span>
              <span className="text-slate-300">GAIN: {settings?.gain.toFixed(1)}x</span>
              <span className="text-sky-300">FPS: {telemetry?.fps || 30}</span>
              <span className="text-slate-400">TEMP: {telemetry?.sensorTempC || 38.6} °C</span>
            </div>

            {/* Bottom Target Status Banner */}
            <div className="absolute bottom-2.5 inset-x-2.5 flex justify-between items-center pointer-events-none font-mono">
              <div className="bg-slate-950/85 backdrop-blur-xs border border-slate-700 px-2.5 py-1 rounded text-[11px] text-slate-300">
                FRAME ID: #{telemetry?.frameCount || 0}
              </div>
              <div
                className={`px-3 py-1 rounded text-xs font-bold border backdrop-blur-xs ${
                  latestResult?.status === 'OK'
                    ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300'
                    : latestResult?.status === 'NOK'
                    ? 'bg-rose-950/90 border-rose-500 text-rose-300 animate-pulse'
                    : 'bg-slate-900/90 border-slate-700 text-slate-300'
                }`}
              >
                {latestResult
                  ? `RESULT: ${latestResult.status === 'OK' ? 'PASSED (OK)' : 'REJECT (NOK)'}`
                  : 'AWAITING TRIGGER'}
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Column: Sensor Parameter Controls & Histogram */}
        <div className="bg-white border border-slate-300 rounded-md p-3 flex flex-col gap-3 overflow-y-auto shadow-xs font-sans">
          {/* Filter Mode Selector */}
          <div>
            <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5 font-mono">
              <Sliders className="w-3.5 h-3.5 text-sky-700" />
              <span>Inspection Filter Mode</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
              {(['EDGE_INSPECTION', 'MONOCHROME', 'RAW_COLOR', 'BINARY_MASK'] as VisionFilterMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => handleFilterChange(mode)}
                  className={`py-1.5 px-2 rounded border text-center transition-all ${
                    settings?.filterMode === mode
                      ? 'bg-sky-600 border-sky-700 text-white font-bold shadow-xs'
                      : 'bg-slate-100 border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  {mode === 'EDGE_INSPECTION'
                    ? 'Analyzed (BBox)'
                    : mode === 'MONOCHROME'
                    ? 'Mono CMOS'
                    : mode === 'RAW_COLOR'
                    ? 'Raw Color'
                    : 'Binary Mask'}
                </button>
              ))}
            </div>
          </div>

          {/* Exposure Time Slider */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs text-slate-700">
              <span className="font-medium">Electronic Exposure:</span>
              <span className="text-sky-800 font-bold font-mono">{settings?.exposureUs || 1250} µs</span>
            </div>
            <input
              type="range"
              min="400"
              max="4000"
              step="50"
              value={settings?.exposureUs || 1250}
              onChange={e => handleExposureChange(parseInt(e.target.value))}
              className="accent-sky-600 bg-slate-200 rounded h-1.5 cursor-pointer"
            />
          </div>

          {/* Sensor Gain Slider */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs text-slate-700">
              <span className="font-medium">Analog Sensor Gain:</span>
              <span className="text-sky-800 font-bold font-mono">{settings?.gain.toFixed(1) || '1.0'}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.1"
              value={settings?.gain || 1.0}
              onChange={e => handleGainChange(parseFloat(e.target.value))}
              className="accent-sky-600 bg-slate-200 rounded h-1.5 cursor-pointer"
            />
          </div>

          {/* LED Spot Illumination Slider */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs text-slate-700">
              <span className="font-medium flex items-center gap-1">
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>LED Spot Illumination:</span>
              </span>
              <span className="text-amber-700 font-bold font-mono">{settings?.ringLightIntensity ?? 85}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={settings?.ringLightIntensity ?? 85}
              onChange={e => handleIlluminationChange(parseInt(e.target.value))}
              className="accent-amber-500 bg-slate-200 rounded h-1.5 cursor-pointer"
            />
          </div>

          {/* Real-time Luminance Histogram */}
          <div className="border border-slate-300 bg-slate-50 rounded p-2.5 flex flex-col gap-1 font-mono">
            <span className="text-[10px] text-slate-600 font-bold flex items-center justify-between">
              <span>LUMINANCE HISTOGRAM</span>
              <span className="text-sky-700 font-semibold">64 BINS</span>
            </span>
            <canvas
              ref={histogramRef}
              width={220}
              height={65}
              className="w-full h-14 rounded border border-slate-300 bg-white"
            />
          </div>

          {/* Defect Localization Report */}
          <div className="flex-1 border border-slate-300 bg-slate-50 rounded p-2.5 flex flex-col gap-2">
            <span className="text-[11px] text-slate-900 font-bold flex items-center gap-1.5 border-b border-slate-200 pb-1 font-mono">
              <Cpu className="w-3.5 h-3.5 text-sky-700" />
              <span>LATEST INSPECTION LOG</span>
            </span>

            {latestResult ? (
              <div className="text-xs flex flex-col gap-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Part Serial:</span>
                  <span className="font-bold text-slate-900">{latestResult.serialNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Latency:</span>
                  <span className="text-amber-700 font-bold">{latestResult.latencyMs} ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Confidence:</span>
                  <span className="text-emerald-700 font-bold">
                    {(latestResult.confidence * 100).toFixed(0)}%
                  </span>
                </div>

                {latestResult.defectInfo ? (
                  <div className="mt-1.5 p-2 rounded bg-rose-50 border border-rose-300 text-rose-950 text-[11px] flex flex-col gap-1">
                    <div className="font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span>DEFECT: {latestResult.defectInfo.type}</span>
                    </div>
                    <div>Bounding Box: [{latestResult.defectInfo.x}, {latestResult.defectInfo.y}, {latestResult.defectInfo.width}, {latestResult.defectInfo.height}]</div>
                    <div>Defect Area: {latestResult.defectInfo.area} pixels</div>
                    <div>Severity Rating: {latestResult.defectInfo.severity}</div>
                  </div>
                ) : (
                  <div className="mt-1.5 p-2 rounded bg-emerald-50 border border-emerald-300 text-emerald-950 text-[11px] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Surface is uniform. Passed threshold limits.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-400 text-xs py-4 text-center font-mono">
                Waiting for optical acquisition...
              </div>
            )}
          </div>

          {/* Last 3 Defective Products Snapshots & Download */}
          <DefectSnapshotsGallery defects={recentDefects} />
        </div>
      </div>
    </div>
  );
};
