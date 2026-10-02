import React from 'react';
import { 
  Play, 
  Pause, 
  AlertOctagon, 
  Sparkles, 
  Compass, 
  Gauge 
} from 'lucide-react';

interface ControlPanelProps {
  isRunning: boolean;
  isEstopActive: boolean;
  conveyorSpeed: number;
  onToggleRun: () => void;
  onToggleEstop: () => void;
  onSpeedChange: (speed: number) => void;
  onForceDefect: () => void;
  onViewPreset: (preset: 'ISOMETRIC' | 'TOP_DOWN' | 'DIVERTER') => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  isRunning,
  isEstopActive,
  conveyorSpeed,
  onToggleRun,
  onToggleEstop,
  onSpeedChange,
  onForceDefect,
  onViewPreset
}) => {
  return (
    <div className="bg-white border border-slate-300 rounded-md p-2.5 flex flex-col gap-2.5 font-sans shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 font-mono">
          <Gauge className="w-4 h-4 text-sky-700" />
          <span>Line Kinematics & Actuators</span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono border border-slate-300 font-semibold">
          PLC-NODE-01
        </span>
      </div>

      {/* Speed Slider */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs text-slate-700">
          <span className="font-medium">Conveyor Velocity:</span>
          <span className="text-sky-800 font-bold font-mono">{conveyorSpeed.toFixed(1)} m/s</span>
        </div>
        <input
          type="range"
          min="0.6"
          max="4.5"
          step="0.1"
          value={conveyorSpeed}
          disabled={isEstopActive}
          onChange={e => onSpeedChange(parseFloat(e.target.value))}
          className="w-full accent-sky-600 bg-slate-200 rounded h-1.5 cursor-pointer disabled:opacity-40"
        />
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>0.6 m/s (Inspect)</span>
          <span>4.5 m/s (High-Speed)</span>
        </div>
      </div>

      {/* Primary Action Buttons */}
      <div className="grid grid-cols-2 gap-2 font-mono">
        <button
          onClick={onToggleRun}
          disabled={isEstopActive}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded text-xs font-bold transition-all shadow-xs ${
            isEstopActive
              ? 'opacity-40 cursor-not-allowed bg-slate-200 text-slate-500 border border-slate-300'
              : isRunning
              ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border border-amber-600'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700'
          }`}
        >
          {isRunning ? (
            <>
              <Pause className="w-3.5 h-3.5" /> PAUSE LINE
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" /> START LINE
            </>
          )}
        </button>

        {/* Force Defect Test Button */}
        <button
          onClick={onForceDefect}
          disabled={isEstopActive || !isRunning}
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-all disabled:opacity-40 shadow-xs"
        >
          <Sparkles className="w-3.5 h-3.5 text-sky-600" />
          <span>INJECT DEFECT</span>
        </button>
      </div>

      {/* 3D Camera View Presets */}
      <div className="flex flex-col gap-1 pt-1 border-t border-slate-200">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold flex items-center gap-1">
          <Compass className="w-3 h-3 text-sky-700" /> Viewport Angle
        </span>
        <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono">
          <button
            onClick={() => onViewPreset('ISOMETRIC')}
            className="py-1 px-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-all text-center"
          >
            Isometric
          </button>
          <button
            onClick={() => onViewPreset('TOP_DOWN')}
            className="py-1 px-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-all text-center"
          >
            Top-Down
          </button>
          <button
            onClick={() => onViewPreset('DIVERTER')}
            className="py-1 px-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-all text-center"
          >
            Piston Spur
          </button>
        </div>
      </div>

      {/* High-Priority Industrial Emergency Stop */}
      <button
        onClick={onToggleEstop}
        className={`w-full py-2.5 rounded font-bold text-xs flex items-center justify-center gap-2 uppercase tracking-widest transition-all shadow-sm ${
          isEstopActive
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse border-2 border-emerald-800'
            : 'bg-red-600 hover:bg-red-700 text-white border-2 border-red-800 active:scale-98'
        }`}
      >
        <AlertOctagon className="w-4 h-4" />
        {isEstopActive ? 'RESET EMERGENCY STOP' : 'EMERGENCY STOP (E-STOP)'}
      </button>
    </div>
  );
};
