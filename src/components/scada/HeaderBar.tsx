import React, { useState, useEffect } from 'react';
import type { ViewMode } from '../../types/scada';
import type { OpenCVStatus } from '../../core/vision/OpenCVLoader';
import { 
  Eye, 
  Layers, 
  Monitor, 
  Cpu
} from 'lucide-react';

interface HeaderBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  openCvStatus: OpenCVStatus;
  isRunning: boolean;
  isEstopActive: boolean;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  viewMode,
  onViewModeChange,
  openCvStatus,
  isRunning,
  isEstopActive
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString() + '.' + String(Math.floor(now.getMilliseconds() / 100)));
    };
    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-12 bg-slate-200 border-b border-slate-300 px-3 flex items-center justify-between shadow-sm z-40 select-none">
      {/* Brand & Line Identity - Industrial Engineering Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded bg-sky-600 flex items-center justify-center shadow-sm border border-sky-700 text-white">
          <Eye className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-1.5 leading-none">
            <h1 className="text-xs font-bold tracking-wider text-slate-900 uppercase font-mono">
              Digital Twin <span className="text-sky-700">Concept Demo</span>
            </h1>
            <span className="text-[10px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-mono border border-amber-300 font-semibold">
              DEMO POC
            </span>
          </div>
          <p className="text-[10px] text-slate-600 font-sans mt-0.5">
            Automated Vision Inspection & Diverter Cell Simulation
          </p>
        </div>
      </div>

      {/* Center View Selector Tabs */}
      <div className="flex items-center bg-slate-300/80 p-0.5 rounded border border-slate-300 shadow-inner">
        <button
          onClick={() => onViewModeChange('3D_TWIN')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-sans font-semibold transition-all ${
            viewMode === '3D_TWIN'
              ? 'bg-white text-sky-800 border border-slate-300 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          3D Digital Twin
        </button>


        <button
          onClick={() => onViewModeChange('STANDALONE_VISION')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-sans font-semibold transition-all ${
            viewMode === 'STANDALONE_VISION'
              ? 'bg-white text-sky-800 border border-slate-300 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Monitor className="w-3.5 h-3.5" />
          Vision Station (HMI)
        </button>
      </div>

      {/* Right Status Badges */}
      <div className="flex items-center gap-2 font-mono text-xs">
        {/* System State Indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white border border-slate-300 shadow-xs">
          <div className="relative flex items-center justify-center">
            <span
              className={`w-2 h-2 rounded-full ${
                isEstopActive
                  ? 'bg-red-600 animate-ping'
                  : isRunning
                  ? 'bg-emerald-600 animate-pulse'
                  : 'bg-amber-500'
              }`}
            />
            <span
              className={`absolute w-2 h-2 rounded-full ${
                isEstopActive ? 'bg-red-600' : isRunning ? 'bg-emerald-600' : 'bg-amber-500'
              }`}
            />
          </div>
          <span className="text-[11px] font-bold text-slate-800">
            {isEstopActive ? 'E-STOP HALT' : isRunning ? 'LINE RUNNING' : 'STANDBY'}
          </span>
        </div>

        {/* OpenCV WebAssembly Engine Badge */}
        <div
          className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-semibold ${
            openCvStatus === 'READY'
              ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
              : openCvStatus === 'LOADING'
              ? 'bg-amber-50 border-amber-300 text-amber-800'
              : 'bg-slate-100 border-slate-300 text-slate-700'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>
            {openCvStatus === 'READY'
              ? 'OPENCV WASM ACTIVE'
              : openCvStatus === 'LOADING'
              ? 'LOADING WASM...'
              : 'JS VISION ENGINE'}
          </span>
        </div>

        {/* PLC Clock */}
        <div className="text-[11px] text-slate-700 font-semibold px-2 py-1 bg-white rounded border border-slate-300 shadow-xs">
          {currentTime || '00:00:00.0'}
        </div>
      </div>
    </header>
  );
};
