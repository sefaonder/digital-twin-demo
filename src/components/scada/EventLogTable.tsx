import React from 'react';
import type { LogEvent } from '../../types/scada';
import { 
  Terminal, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  AlertOctagon, 
  Trash2 
} from 'lucide-react';

interface EventLogTableProps {
  logs: LogEvent[];
  onClear: () => void;
}

export const EventLogTable: React.FC<EventLogTableProps> = ({ logs, onClear }) => {
  return (
    <div className="bg-white border border-slate-300 rounded-md p-2.5 flex flex-col font-sans shadow-xs h-full">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2 font-mono">
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-sky-700" />
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            SCADA Event & Alarm Journal
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-300 font-semibold">
            {logs.length} EVENTS
          </span>
        </div>
        <button
          onClick={onClear}
          title="Clear Event Journal"
          className="text-slate-500 hover:text-rose-600 p-1 rounded hover:bg-slate-100 transition-all text-xs flex items-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="text-[10px]">Clear</span>
        </button>
      </div>

      {/* Log Feed */}
      <div className="flex-1 overflow-y-auto max-h-[220px] flex flex-col gap-1.5 pr-1 select-text scrollbar-thin scrollbar-thumb-slate-300 font-mono">
        {logs.length === 0 ? (
          <div className="text-slate-400 text-xs py-4 text-center">
            No events recorded yet. Ready for line telemetry.
          </div>
        ) : (
          logs.map(log => {
            let badgeStyle = 'text-slate-700 border-slate-300 bg-slate-100';
            let itemBg = 'bg-slate-50 border-slate-200 text-slate-800';
            let Icon = Info;

            if (log.type === 'PASS') {
              badgeStyle = 'text-emerald-800 border-emerald-300 bg-emerald-100';
              itemBg = 'bg-emerald-50/60 border-emerald-200 text-emerald-950';
              Icon = CheckCircle;
            } else if (log.type === 'DEFECT') {
              badgeStyle = 'text-rose-800 border-rose-300 bg-rose-100';
              itemBg = 'bg-rose-50/60 border-rose-200 text-rose-950';
              Icon = AlertTriangle;
            } else if (log.type === 'ALARM') {
              badgeStyle = 'text-amber-800 border-amber-300 bg-amber-100';
              itemBg = 'bg-amber-50/60 border-amber-200 text-amber-950';
              Icon = AlertOctagon;
            }

            return (
              <div
                key={log.id}
                className={`text-[11px] p-1.5 rounded border flex items-start gap-2 transition-all ${itemBg}`}
              >
                <div className={`p-0.5 rounded border mt-0.5 ${badgeStyle}`}>
                  <Icon className="w-3 h-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold truncate">{log.message}</span>
                    <span className="text-[10px] text-slate-500 shrink-0 font-normal">{log.timestamp}</span>
                  </div>
                  {log.details && (
                    <div className="text-[10px] text-slate-600 mt-0.5 break-all font-sans">
                      {log.details}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
