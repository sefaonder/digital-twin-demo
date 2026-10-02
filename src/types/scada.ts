export type PartStatus = 'PENDING' | 'INSPECTING' | 'OK' | 'NOK' | 'REJECTED' | 'PASSED';

export type DefectType = 'NONE' | 'SCRATCH' | 'SURFACE_SPOT' | 'CONTAMINATION' | 'CRACK';

export interface DefectInfo {
  type: DefectType;
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface WorkpieceData {
  id: string;
  serialNumber: string;
  spawnTime: number;
  status: PartStatus;
  defectInfo: DefectInfo | null;
  textureCanvas?: HTMLCanvasElement;
  hasVisualDefect: boolean;
}

export interface PartBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
}

export interface DefectBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
}

export interface DefectSnapshotRecord {
  id: string;
  serialNumber: string;
  timestamp: string;
  timestampMs: number;
  status: 'NOK';
  defectType: DefectType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  partBox: PartBoundingBox;
  defectBox: DefectBoundingBox;
  confidence: number;
  latencyMs: number;
  engineUsed: 'OPENCV_WASM' | 'PIXEL_FALLBACK';
  annotatedImageUrl: string;
  rawImageUrl: string;
}

export interface InspectionResult {
  partId: string;
  serialNumber: string;
  status: 'OK' | 'NOK';
  timestamp: number;
  defectInfo: DefectInfo | null;
  partBox?: PartBoundingBox;
  latencyMs: number;
  confidence: number;
  engineUsed: 'OPENCV_WASM' | 'PIXEL_FALLBACK';
  sensorSnapshotUrl?: string;
  annotatedImageUrl?: string;
  rawImageUrl?: string;
}

export interface ProductionTelemetry {
  totalInspected: number;
  passedCount: number;
  rejectedCount: number;
  yieldRate: number; // %
  defectRate: number; // %
  lastLatencyMs: number;
  avgLatencyMs: number;
  conveyorSpeed: number; // m/s units
  isRunning: boolean;
  isEstopActive: boolean;
  activePartsInSystem: number;
}

export type VisionFilterMode = 'RAW_COLOR' | 'MONOCHROME' | 'EDGE_INSPECTION' | 'BINARY_MASK';

export type ViewMode = '3D_TWIN' | 'STANDALONE_VISION';

export interface SensorSettings {
  filterMode: VisionFilterMode;
  exposureUs: number; // exposure time in microseconds
  gain: number;
  sensorFps: number;
  showOverlay: boolean;
  showCrosshair: boolean;
  hardwareTriggerMode: 'PHOTOEYE_AUTO' | 'CONTINUOUS';
  ringLightIntensity: number; // 0 to 100
}

export interface LogEvent {
  id: string;
  timestamp: string;
  type: 'INFO' | 'PASS' | 'DEFECT' | 'ALARM' | 'SYSTEM';
  message: string;
  details?: string;
}
