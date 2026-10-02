import type { ProductionTelemetry } from '../../types/scada';
import { 
  CheckCircle, 
  XCircle, 
  Percent, 
  Gauge, 
  Zap, 
  Box 
} from 'lucide-react';

interface TelemetryCardsProps {
  telemetry: ProductionTelemetry;
}

export const TelemetryCards: React.FC<TelemetryCardsProps> = ({ telemetry }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
      {/* 1. Total Inspected */}
      <div className="bg-white border border-slate-300 p-2.5 rounded-md shadow-xs relative overflow-hidden group">
        <div className="flex items-center justify-between text-slate-600 mb-0.5">
          <span className="text-[10px] font-sans font-bold uppercase tracking-wider">Total Parts</span>
          <Box className="w-3.5 h-3.5 text-sky-600" />
        </div>
        <div className="text-xl font-bold font-mono text-slate-900">
          {telemetry.totalInspected}
        </div>
        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
          Active in line: {telemetry.activePartsInSystem}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600" />
      </div>

      {/* 2. Passed Parts */}
      <div className="bg-white border border-slate-300 p-2.5 rounded-md shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-emerald-700 mb-0.5">
          <span className="text-[10px] font-sans font-bold uppercase tracking-wider">Passed (OK)</span>
          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
        </div>
        <div className="text-xl font-bold font-mono text-emerald-700">
          {telemetry.passedCount}
        </div>
        <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
          <div
            className="bg-emerald-600 h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, telemetry.yieldRate || 100)}%` }}
          />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600" />
      </div>

      {/* 3. Rejected Parts */}
      <div className="bg-white border border-slate-300 p-2.5 rounded-md shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-rose-700 mb-0.5">
          <span className="text-[10px] font-sans font-bold uppercase tracking-wider">Diverted (NOK)</span>
          <XCircle className="w-3.5 h-3.5 text-rose-600" />
        </div>
        <div className="text-xl font-bold font-mono text-rose-700">
          {telemetry.rejectedCount}
        </div>
        <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
          <div
            className="bg-rose-600 h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, telemetry.defectRate || 0)}%` }}
          />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-600" />
      </div>

      {/* 4. Yield Rate */}
      <div className="bg-white border border-slate-300 p-2.5 rounded-md shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-600 mb-0.5">
          <span className="text-[10px] font-sans font-bold uppercase tracking-wider">Yield Rate</span>
          <Percent className="w-3.5 h-3.5 text-sky-600" />
        </div>
        <div className="text-xl font-bold font-mono text-sky-800">
          {telemetry.totalInspected > 0 ? `${telemetry.yieldRate}%` : '100.0%'}
        </div>
        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
          Defect Rate: {telemetry.totalInspected > 0 ? `${telemetry.defectRate}%` : '0.0%'}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600" />
      </div>

      {/* 5. Edge Vision Latency */}
      <div className="bg-white border border-slate-300 p-2.5 rounded-md shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-600 mb-0.5">
          <span className="text-[10px] font-sans font-bold uppercase tracking-wider">Vision Latency</span>
          <Zap className="w-3.5 h-3.5 text-amber-600" />
        </div>
        <div className="text-xl font-bold font-mono text-amber-700 flex items-baseline gap-1">
          {telemetry.lastLatencyMs || 0}
          <span className="text-xs text-slate-500 font-normal">ms</span>
        </div>
        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
          Avg: {telemetry.avgLatencyMs || 0} ms (Edge)
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600" />
      </div>

      {/* 6. Line Velocity */}
      <div className="bg-white border border-slate-300 p-2.5 rounded-md shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-600 mb-0.5">
          <span className="text-[10px] font-sans font-bold uppercase tracking-wider">Line Speed</span>
          <Gauge className="w-3.5 h-3.5 text-slate-600" />
        </div>
        <div className="text-xl font-bold font-mono text-slate-900 flex items-baseline gap-1">
          {telemetry.isRunning && !telemetry.isEstopActive ? telemetry.conveyorSpeed.toFixed(1) : '0.0'}
          <span className="text-xs text-slate-500 font-normal">m/s</span>
        </div>
        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
          Throughput: ~{Math.round((telemetry.conveyorSpeed / 2.4) * 25)} ppm
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-600" />
      </div>
    </div>
  );
};
