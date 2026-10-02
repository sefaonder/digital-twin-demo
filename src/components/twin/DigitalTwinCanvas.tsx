import React, { useRef, useEffect } from 'react';
import { SceneManager, type SceneCallbacks } from '../../core/sim/SceneManager';

interface DigitalTwinCanvasProps {
  onSceneReady: (sceneManager: SceneManager) => void;
  callbacks: SceneCallbacks;
}

export const DigitalTwinCanvas: React.FC<DigitalTwinCanvasProps> = ({
  onSceneReady,
  callbacks
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);
  const callbacksRef = useRef<SceneCallbacks>(callbacks);
  const onSceneReadyRef = useRef<(sm: SceneManager) => void>(onSceneReady);

  useEffect(() => {
    callbacksRef.current = callbacks;
    onSceneReadyRef.current = onSceneReady;
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Purge any lingering children in container
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // Proxy callbacks to always invoke the latest callbacks
    const proxyCallbacks: SceneCallbacks = {
      onInspection: res => callbacksRef.current.onInspection(res),
      onTelemetryUpdate: tel => callbacksRef.current.onTelemetryUpdate(tel),
      onLogEvent: evt => callbacksRef.current.onLogEvent(evt),
      onDefectSnapshot: record => callbacksRef.current.onDefectSnapshot?.(record)
    };

    // Initialize 3D Scene
    const sm = new SceneManager(container, proxyCallbacks);
    sceneManagerRef.current = sm;
    onSceneReadyRef.current(sm);

    // Responsive Canvas Resize Observer
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          sm.handleResize(entry.contentRect.width, entry.contentRect.height);
        }
      }
    });

    ro.observe(container);

    return () => {
      ro.disconnect();
      sm.destroy();
      sceneManagerRef.current = null;
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, []);

  return (
    <div className="w-full h-full relative overflow-hidden select-none cursor-grab active:cursor-grabbing bg-slate-200">
      {/* Dedicated Three.js canvas mount container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* 3D Viewport Controls Hint */}
      <div className="absolute bottom-2.5 left-2.5 bg-white/90 border border-slate-300 text-[10px] font-mono px-2 py-0.5 rounded text-slate-700 shadow-xs pointer-events-none flex items-center gap-1.5 z-10">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-600" />
        <span>Left Click + Drag: Orbit | Scroll: Zoom</span>
      </div>
    </div>
  );
};
