import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { 
  ProductionTelemetry, 
  InspectionResult, 
  LogEvent, 
  ViewMode,
  DefectSnapshotRecord 
} from './types/scada';
import { openCVLoader, type OpenCVStatus } from './core/vision/OpenCVLoader';
import { SceneManager } from './core/sim/SceneManager';
import { IndustrialVisionSensor } from './core/sensor/IndustrialVisionSensor';
import { HeaderBar } from './components/scada/HeaderBar';
import { TelemetryCards } from './components/scada/TelemetryCards';
import { VisionSensorMonitor } from './components/scada/VisionSensorMonitor';
import { DefectSnapshotsGallery } from './components/scada/DefectSnapshotsGallery';
import { ControlPanel } from './components/scada/ControlPanel';
import { EventLogTable } from './components/scada/EventLogTable';
import { StandaloneVisionStation } from './components/scada/StandaloneVisionStation';
import { DigitalTwinCanvas } from './components/twin/DigitalTwinCanvas';

export const App: React.FC = () => {
  const [openCvStatus, setOpenCvStatus] = useState<OpenCVStatus>('LOADING');
  const [viewMode, setViewMode] = useState<ViewMode>('3D_TWIN');
  const [sceneManager, setSceneManager] = useState<SceneManager | null>(null);
  const [visionSensor, setVisionSensor] = useState<IndustrialVisionSensor | null>(null);
  const [latestResult, setLatestResult] = useState<InspectionResult | null>(null);
  const [recentDefects, setRecentDefects] = useState<DefectSnapshotRecord[]>([]);

  const [telemetry, setTelemetry] = useState<ProductionTelemetry>({
    totalInspected: 0,
    passedCount: 0,
    rejectedCount: 0,
    yieldRate: 100.0,
    defectRate: 0.0,
    lastLatencyMs: 0,
    avgLatencyMs: 0,
    conveyorSpeed: 2.4,
    isRunning: true,
    isEstopActive: false,
    activePartsInSystem: 0
  });

  const [logs, setLogs] = useState<LogEvent[]>(() => [
    {
      id: 'init-1',
      timestamp: new Date().toLocaleTimeString(),
      type: 'SYSTEM',
      message: 'Digital Twin Concept Demo Initialized',
      details: 'Conveyor PLC simulation linked. Vision pipeline standby.'
    }
  ]);

  const addLog = useCallback((event: Omit<LogEvent, 'id' | 'timestamp'>) => {
    const newLog: LogEvent = {
      ...event,
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString()
    };
    setLogs(prev => [newLog, ...prev.slice(0, 199)]);
  }, []);

  // Load OpenCV.js asynchronously
  useEffect(() => {
    const unsub = openCVLoader.subscribe(status => {
      setOpenCvStatus(status);
    });

    openCVLoader.load().then(ready => {
      if (ready) {
        addLog({
          type: 'INFO',
          message: 'OpenCV.js WebAssembly Engine Ready (WASM SIMD Acceleration Enabled)'
        });
      } else {
        addLog({
          type: 'ALARM',
          message: 'OpenCV.js load deferred. High-performance Pixel Engine active.'
        });
      }
    });

    return () => unsub();
  }, [addLog]);

  const handleInspection = useCallback((result: InspectionResult) => {
    setLatestResult(result);
  }, []);

  const handleDefectSnapshot = useCallback((record: DefectSnapshotRecord) => {
    setRecentDefects(prev => [record, ...prev.slice(0, 2)]);
  }, []);

  const handleTelemetryUpdate = useCallback((partial: Partial<ProductionTelemetry>) => {
    setTelemetry(prev => ({ ...prev, ...partial }));
  }, []);

  const handleSceneReady = useCallback((sm: SceneManager) => {
    setSceneManager(sm);
    setVisionSensor(sm.visionSensor);
  }, []);

  // Controls
  const toggleRun = () => {
    if (!sceneManager) return;
    const next = !telemetry.isRunning;
    sceneManager.setRunning(next);
    setTelemetry(prev => ({ ...prev, isRunning: next }));
  };

  const toggleEstop = () => {
    if (!sceneManager) return;
    sceneManager.triggerEstop();
    setTelemetry(prev => ({
      ...prev,
      isEstopActive: !prev.isEstopActive,
      isRunning: prev.isEstopActive ? true : false
    }));
  };

  const handleSpeedChange = (speed: number) => {
    if (!sceneManager) return;
    sceneManager.setConveyorSpeed(speed);
    setTelemetry(prev => ({ ...prev, conveyorSpeed: speed }));
  };

  const handleForceDefect = () => {
    if (!sceneManager) return;
    sceneManager.forceNextDefect();
  };

  const handleViewPreset = (preset: 'ISOMETRIC' | 'TOP_DOWN' | 'DIVERTER') => {
    if (!sceneManager) return;
    sceneManager.setViewPreset(preset);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const callbacks = useMemo(() => ({
    onInspection: handleInspection,
    onTelemetryUpdate: handleTelemetryUpdate,
    onLogEvent: addLog,
    onDefectSnapshot: handleDefectSnapshot
  }), [handleInspection, handleTelemetryUpdate, addLog, handleDefectSnapshot]);

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 text-slate-900 overflow-hidden font-sans">
      {/* 1. Industrial SCADA Top Bar */}
      <HeaderBar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        openCvStatus={openCvStatus}
        isRunning={telemetry.isRunning}
        isEstopActive={telemetry.isEstopActive}
      />

      {/* Main SCADA Workspace */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Dedicated Machine Vision Screen */}
        {viewMode === 'STANDALONE_VISION' && (
          <div className="absolute inset-0 z-20 flex flex-col bg-slate-100">
            <StandaloneVisionStation
              sensor={visionSensor}
              latestResult={latestResult}
              recentDefects={recentDefects}
              onBackToTwin={() => setViewMode('3D_TWIN')}
            />
          </div>
        )}

        {/* 3D Digital Twin & SCADA Workspace Layout */}
        <div className="flex-1 flex flex-col overflow-y-auto lg:overflow-hidden p-2.5 gap-2.5">
          {/* Top KPI Telemetry Strip */}
          <div className="shrink-0">
            <TelemetryCards telemetry={telemetry} />
          </div>

          {/* Main Visual & Control Workspace */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2.5 min-h-[500px] lg:min-h-0">
            {/* Left Column: 3D Digital Twin Simulation */}
            <div className="lg:col-span-8 min-h-[380px] lg:min-h-0 rounded-md overflow-hidden border border-slate-300 relative bg-slate-200 flex flex-col shadow-xs">
              <DigitalTwinCanvas
                onSceneReady={handleSceneReady}
                callbacks={callbacks}
              />

              {/* In-viewport Floating Overlay for 3D Twin mode */}
              <div className="absolute top-2.5 right-2.5 flex items-center gap-2 pointer-events-none font-mono">
                <div className="bg-white/90 backdrop-blur-xs border border-slate-300 px-2.5 py-1 rounded text-[11px] text-slate-800 shadow-xs">
                  <span>SORTING DIVERTER: </span>
                  <span className="text-emerald-700 font-bold">READY</span>
                </div>
              </div>
            </div>

            {/* Right Column: Live Vision Feed & SCADA Operation Console */}
            <div className="lg:col-span-4 flex flex-col gap-2.5 min-h-0 overflow-y-auto pr-0.5">
              {/* Live Smart Camera Vision Monitor */}
              <VisionSensorMonitor
                sensor={visionSensor}
                latestResult={latestResult}
                onMaximize={() => setViewMode('STANDALONE_VISION')}
              />

              {/* Last 3 Defective Products Snapshots & Direct Download */}
              <DefectSnapshotsGallery defects={recentDefects} />

              {/* Kinematics & Actuators Control Panel */}
              <ControlPanel
                isRunning={telemetry.isRunning}
                isEstopActive={telemetry.isEstopActive}
                conveyorSpeed={telemetry.conveyorSpeed}
                onToggleRun={toggleRun}
                onToggleEstop={toggleEstop}
                onSpeedChange={handleSpeedChange}
                onForceDefect={handleForceDefect}
                onViewPreset={handleViewPreset}
              />

              {/* Real-time Alarm & Event Journal */}
              <div className="flex-1 min-h-[180px]">
                <EventLogTable logs={logs} onClear={clearLogs} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
