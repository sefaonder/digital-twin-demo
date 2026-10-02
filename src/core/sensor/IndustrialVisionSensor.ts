import * as THREE from 'three';
import type { SensorSettings, InspectionResult } from '../../types/scada';

export interface SensorTelemetry {
  fps: number;
  exposureUs: number;
  sensorTempC: number;
  gain: number;
  frameCount: number;
  triggerStatus: 'IDLE' | 'ACQUIRING' | 'TRIGGERED' | 'FAULT';
  lastCaptureTime: number;
}

export type FrameListener = (
  canvas: HTMLCanvasElement,
  telemetry: SensorTelemetry,
  latestResult: InspectionResult | null
) => void;

export class IndustrialVisionSensor {
  public camera: THREE.OrthographicCamera;
  public renderTarget: THREE.WebGLRenderTarget;
  public cameraGroup: THREE.Group;
  
  // Internal sensor image buffer
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D;
  private pixelBuffer: Uint8Array;

  // Processed sensor canvas (with monochrome, noise, overlay etc.)
  public displayCanvas: HTMLCanvasElement;
  private displayCtx: CanvasRenderingContext2D;

  private settings: SensorSettings;
  private telemetry: SensorTelemetry;
  private listeners: FrameListener[] = [];
  private latestResult: InspectionResult | null = null;
  private lastFpsTimestamp = performance.now();
  private framesSinceLastSec = 0;

  // Inspection zone position in 3D world
  public static readonly ZONE_X = 0; // Center of inspection line
  public static readonly ZONE_Z = 0;
  public static readonly RESOLUTION = 256;

  constructor() {
    this.settings = {
      filterMode: 'EDGE_INSPECTION',
      exposureUs: 1250,
      gain: 1.0,
      sensorFps: 30,
      showOverlay: true,
      showCrosshair: true,
      hardwareTriggerMode: 'PHOTOEYE_AUTO',
      ringLightIntensity: 85
    };

    this.telemetry = {
      fps: 30,
      exposureUs: 1250,
      sensorTempC: 38.6,
      gain: 1.0,
      frameCount: 0,
      triggerStatus: 'IDLE',
      lastCaptureTime: Date.now()
    };

    // Telecentric machine vision lens emulation (Orthographic)
    const frustumSize = 2.4;
    this.camera = new THREE.OrthographicCamera(
      -frustumSize / 2,
      frustumSize / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      10
    );

    // Position directly below camera lens barrel looking down to avoid self-occlusion
    this.camera.position.set(IndustrialVisionSensor.ZONE_X, 2.7, IndustrialVisionSensor.ZONE_Z);
    this.camera.lookAt(IndustrialVisionSensor.ZONE_X, 0, IndustrialVisionSensor.ZONE_Z);

    // WebGLRenderTarget for capturing high-speed sensor frames
    this.renderTarget = new THREE.WebGLRenderTarget(
      IndustrialVisionSensor.RESOLUTION,
      IndustrialVisionSensor.RESOLUTION,
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat
      }
    );

    // Offscreen raw canvas
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = IndustrialVisionSensor.RESOLUTION;
    this.offscreenCanvas.height = IndustrialVisionSensor.RESOLUTION;
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true })!;

    // Processed sensor output canvas
    this.displayCanvas = document.createElement('canvas');
    this.displayCanvas.width = IndustrialVisionSensor.RESOLUTION;
    this.displayCanvas.height = IndustrialVisionSensor.RESOLUTION;
    this.displayCtx = this.displayCanvas.getContext('2d')!;

    this.pixelBuffer = new Uint8Array(IndustrialVisionSensor.RESOLUTION * IndustrialVisionSensor.RESOLUTION * 4);

    // 3D physical model of the camera housing and 4 corner spot LEDs
    this.cameraGroup = this.buildPhysicalSensorModel();
  }

  private spotLights: THREE.PointLight[] = [];

  /**
   * Builds realistic 3D mesh representation of an authentic high-precision industrial smart camera (Keyence/Cognex style)
   */
  private buildPhysicalSensorModel(): THREE.Group {
    const group = new THREE.Group();
    group.position.set(IndustrialVisionSensor.ZONE_X, 3.8, IndustrialVisionSensor.ZONE_Z);

    // Common Industrial Materials
    const darkBodyMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Anodized dark graphite industrial finish
      metalness: 0.85,
      roughness: 0.25
    });

    const brushedAlumMat = new THREE.MeshStandardMaterial({
      color: 0xd8e1eb, // Precision machined clear aluminum
      metalness: 0.9,
      roughness: 0.2
    });

    const accentBlueMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Precision engineering blue accent
      metalness: 0.8,
      roughness: 0.3
    });

    const hardwareMat = new THREE.MeshStandardMaterial({
      color: 0x475569, // M4/M5 socket head hardware
      metalness: 0.95,
      roughness: 0.3
    });

    // 1. Main Camera Enclosure (Compact High-Precision Smart Camera)
    // Realistic proportions: 0.44m wide x 0.44m deep x 0.48m tall
    const bodyGeo = new THREE.BoxGeometry(0.44, 0.48, 0.44);
    const bodyMesh = new THREE.Mesh(bodyGeo, darkBodyMat);
    bodyMesh.position.y = 0;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // Front Machined Aluminum Faceplate Bezel
    const faceplateGeo = new THREE.BoxGeometry(0.45, 0.05, 0.45);
    const faceplate = new THREE.Mesh(faceplateGeo, brushedAlumMat);
    faceplate.position.y = -0.245;
    group.add(faceplate);

    // Rear Top Connection Plate
    const topPlateGeo = new THREE.BoxGeometry(0.45, 0.05, 0.45);
    const topPlate = new THREE.Mesh(topPlateGeo, accentBlueMat);
    topPlate.position.y = 0.245;
    group.add(topPlate);

    // Corner Stainless Steel Hex Assembly Bolts (4 top, 4 bottom)
    const boltGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.02, 8);
    const boltPositions = [
      [-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]
    ];
    boltPositions.forEach(([bx, bz]) => {
      const topBolt = new THREE.Mesh(boltGeo, hardwareMat);
      topBolt.position.set(bx, 0.27, bz);
      group.add(topBolt);

      const botBolt = new THREE.Mesh(boltGeo, hardwareMat);
      botBolt.position.set(bx, -0.27, bz);
      group.add(botBolt);
    });

    // Side CNC Milled Heat Sink Cooling Ribs
    const finMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.35 });
    [-0.225, 0.225].forEach(x => {
      for (let y = -0.16; y <= 0.16; y += 0.055) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.025, 0.38), finMat);
        fin.position.set(x, y, 0);
        group.add(fin);
      }
    });

    // Status Indicator LED Panel on Rear (+Z side)
    const statusLeds = [
      { name: 'PWR', color: 0x22c55e, x: -0.12 },
      { name: 'NET', color: 0xf59e0b, x: -0.04 },
      { name: 'TRIG', color: 0x06b6d4, x: 0.04 },
      { name: 'STAT', color: 0x10b981, x: 0.12 }
    ];
    statusLeds.forEach(s => {
      const led = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.015, 12),
        new THREE.MeshStandardMaterial({ color: s.color, emissive: s.color, emissiveIntensity: 1.0 })
      );
      led.rotation.x = Math.PI / 2;
      led.position.set(s.x, 0.14, 0.225);
      group.add(led);
    });

    // Dual Nickel-Plated Industrial M12 Connectors on Top (Power & GigE Vision)
    const m12Mat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.15 });
    [-0.09, 0.09].forEach(x => {
      const connBody = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 16), m12Mat);
      connBody.position.set(x, 0.32, -0.06);
      group.add(connBody);

      // Knurled Locking Nut Ring
      const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.04, 16), hardwareMat);
      nut.position.set(x, 0.34, -0.06);
      group.add(nut);
    });

    // Flexible Shielded Industrial Cable Conduit with Realistic Drape
    const cableCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.09, 0.38, -0.06),
      new THREE.Vector3(-0.15, 0.55, -0.15),
      new THREE.Vector3(-0.25, 0.72, -0.4),
      new THREE.Vector3(-0.35, 0.8, -0.8)
    ]);
    const cableGeo = new THREE.TubeGeometry(cableCurve, 20, 0.022, 8, false);
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 });
    const cable = new THREE.Mesh(cableGeo, cableMat);
    group.add(cable);

    // 2. High-Precision C-Mount Telecentric Optical Lens Assembly
    const lensGroup = new THREE.Group();
    lensGroup.position.y = -0.27;

    // C-Mount Threaded Adapter Flange
    const flangeGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.06, 32);
    const flange = new THREE.Mesh(flangeGeo, brushedAlumMat);
    flange.position.y = -0.03;
    lensGroup.add(flange);

    // Main Optical Barrel Body (Matte Black Anodized)
    const barrelGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.28, 32);
    const barrel = new THREE.Mesh(barrelGeo, darkBodyMat);
    barrel.position.y = -0.18;
    lensGroup.add(barrel);

    // Knurled Focus and Aperture Adjustment Rings (Dual Precision Grips)
    const knurlGeo = new THREE.CylinderGeometry(0.172, 0.172, 0.05, 32);
    const knurlMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.35 });
    [-0.12, -0.22].forEach(y => {
      const kRing = new THREE.Mesh(knurlGeo, knurlMat);
      kRing.position.y = y;
      lensGroup.add(kRing);

      // Silver Index Tick Marks Ring
      const indexRing = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.015, 32), brushedAlumMat);
      indexRing.position.y = y + 0.032;
      lensGroup.add(indexRing);
    });

    // Front Threaded Optical Lens Hood & Bezel Ring
    const hoodGeo = new THREE.CylinderGeometry(0.19, 0.16, 0.08, 32);
    const hood = new THREE.Mesh(hoodGeo, darkBodyMat);
    hood.position.y = -0.34;
    lensGroup.add(hood);

    // Multi-Coated Optical Glass Front Element (Emerald / Cyan Anti-Reflective Sheen)
    const glassGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.015, 32);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4, // Cyan optical coating
      roughness: 0.02,
      metalness: 0.92,
      transparent: true,
      opacity: 0.75
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.y = -0.37;
    lensGroup.add(glass);

    group.add(lensGroup);

    // 3. Integrated Industrial Quad-Sector LED Vision Spotlight Pods
    this.spotLights = [];
    const ledRadius = 0.16;
    const ledAngles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];

    const ledHousingGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.03, 16);
    const ledDiffuserGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.01, 16);
    const ledDiffuserMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.2,
      roughness: 0.1
    });

    ledAngles.forEach(angle => {
      const lx = Math.cos(angle) * ledRadius;
      const lz = Math.sin(angle) * ledRadius;

      // Chrome Housing Cup
      const cup = new THREE.Mesh(ledHousingGeo, brushedAlumMat);
      cup.position.set(lx, -0.275, lz);
      group.add(cup);

      // Diffused Emitter Lens
      const emitter = new THREE.Mesh(ledDiffuserGeo, ledDiffuserMat);
      emitter.position.set(lx, -0.29, lz);
      group.add(emitter);

      // Dedicated Downward Target Illumination
      const pLight = new THREE.PointLight(0xffffff, 1.4, 4.5, 1.2);
      pLight.position.set(lx, -0.35, lz);
      group.add(pLight);
      this.spotLights.push(pLight);
    });

    // 4. Heavy-Duty Rexroth Extrusion Gantry Bridge System (80x80 Aluminum Profiles)
    const alumStrutMat = new THREE.MeshStandardMaterial({
      color: 0xc8d3df,
      metalness: 0.85,
      roughness: 0.25
    });

    const columnHeight = 3.6;
    const colGeo = new THREE.BoxGeometry(0.12, columnHeight, 0.12);

    // Two Sturdy Vertical Support Columns bolted to conveyor side rails
    [-1.15, 1.15].forEach(z => {
      const col = new THREE.Mesh(colGeo, alumStrutMat);
      col.position.set(0, -columnHeight / 2 + 0.45, z);
      col.castShadow = true;
      group.add(col);

      // Heavy Floor & Chassis Mounting Base Plate
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.26), darkBodyMat);
      foot.position.set(0, -3.2, z);
      group.add(foot);

      // Structural Gusset Angle Brackets
      const gusset = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.24), darkBodyMat);
      gusset.position.set(0, 0.32, z);
      group.add(gusset);
    });

    // Overhead Structural Cross-Beam
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 2.5), alumStrutMat);
    beam.position.set(0, 0.46, 0);
    beam.castShadow = true;
    group.add(beam);

    // Precision Dovetail Camera Mounting Carrier & Swivel Stem
    const carrier = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.3), darkBodyMat);
    carrier.position.set(0, 0.46, 0);
    group.add(carrier);

    const swivelStem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.25, 16), brushedAlumMat);
    swivelStem.position.set(0, 0.32, 0);
    group.add(swivelStem);

    return group;
  }

  /**
   * Subscribe to camera frame stream
   */
  public onFrame(listener: FrameListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public setLatestResult(result: InspectionResult | null) {
    this.latestResult = result;
  }

  public getSettings(): SensorSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<SensorSettings>) {
    this.settings = { ...this.settings, ...partial };
    if (typeof partial.ringLightIntensity === 'number') {
      const mult = (partial.ringLightIntensity / 100) * 1.5;
      this.spotLights.forEach(l => {
        l.intensity = mult;
      });
    }
  }

  public getTelemetry(): SensorTelemetry {
    return { ...this.telemetry };
  }

  public setTriggerStatus(status: 'IDLE' | 'ACQUIRING' | 'TRIGGERED' | 'FAULT') {
    this.telemetry.triggerStatus = status;
  }

  public getRawCanvas(): HTMLCanvasElement {
    return this.offscreenCanvas;
  }

  /**
   * Generates a calibrated 512x512 optical inspection frame of the workpiece on the conveyor line,
   * rendering the dark industrial conveyor background and the metallic cube passing underneath.
   */
  public createInspectionFrame(
    topCanvas: HTMLCanvasElement,
    lateralOffset = 0,
    rotationAngle = 0
  ): HTMLCanvasElement {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // 1. Conveyor Belt Background (Dark industrial matte black/charcoal, luma ~ 25)
    ctx.fillStyle = '#141a22';
    ctx.fillRect(0, 0, size, size);

    // Fine rubber belt friction ribs
    ctx.fillStyle = '#0f141a';
    for (let i = 0; i < 32; i++) {
      ctx.fillRect(0, i * 16, size, 2);
    }

    // Heavy extruded side guide rails (luma ~ 55)
    ctx.fillStyle = '#27303f';
    ctx.fillRect(0, 0, size, 28);
    ctx.fillRect(0, size - 28, size, 28);
    ctx.fillStyle = '#3e4c63';
    ctx.fillRect(0, 26, size, 2);
    ctx.fillRect(0, size - 28, size, 2);

    // Telecentric Calibration Grid lines (subtle dashed lines)
    ctx.strokeStyle = 'rgba(74, 85, 104, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 12]);
    for (let x = 64; x < size; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 28);
      ctx.lineTo(x, size - 28);
      ctx.stroke();
    }
    for (let y = 64; y < size - 28; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 2. Metallic Cube Workpiece Position (luma ~ 220)
    const partSize = 250;
    const centerX = size / 2;
    // Map lateralOffset (-0.2 to +0.2) to pixels
    const clampedOffset = Math.max(-28, Math.min(28, lateralOffset * 140));
    const centerY = size / 2 + clampedOffset;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(Math.max(-0.12, Math.min(0.12, rotationAngle)));

    // Outer drop shadow on belt
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 4;

    // Outer metallic bevel / chamfer rim
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(-partSize / 2, -partSize / 2, partSize, partSize);

    // Reset shadow for surface
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Draw the actual workpiece top canvas (brushed metal + defect)
    const inset = 3;
    ctx.drawImage(
      topCanvas,
      -partSize / 2 + inset,
      -partSize / 2 + inset,
      partSize - inset * 2,
      partSize - inset * 2
    );

    ctx.restore();

    return canvas;
  }

  /**
   * Render the virtual camera view from the Three.js scene to offscreen buffer
   */
  public captureFrame(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    // Hide visual frustum cone temporarily during frame capture to avoid self-occlusion
    const cone = this.cameraGroup.children.find(c => c instanceof THREE.Mesh && c.material instanceof THREE.MeshBasicMaterial);
    if (cone) cone.visible = false;

    // Render to WebGLRenderTarget
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.renderTarget);
    renderer.render(scene, this.camera);
    renderer.readRenderTargetPixels(
      this.renderTarget,
      0,
      0,
      IndustrialVisionSensor.RESOLUTION,
      IndustrialVisionSensor.RESOLUTION,
      this.pixelBuffer
    );
    renderer.setRenderTarget(prevTarget);

    if (cone) cone.visible = true;

    // Draw raw pixels to offscreen 2D canvas (Note: WebGL pixels are inverted vertically)
    const imgData = this.offscreenCtx.createImageData(
      IndustrialVisionSensor.RESOLUTION,
      IndustrialVisionSensor.RESOLUTION
    );

    const res = IndustrialVisionSensor.RESOLUTION;
    for (let y = 0; y < res; y++) {
      const srcRow = (res - 1 - y) * res * 4;
      const dstRow = y * res * 4;
      for (let x = 0; x < res * 4; x++) {
        imgData.data[dstRow + x] = this.pixelBuffer[srcRow + x];
      }
    }
    this.offscreenCtx.putImageData(imgData, 0, 0);

    // Apply Sensor Post-Processing (Monochrome, Exposure, Overlay)
    this.processSensorDisplayImage(imgData);

    // Telemetry updates
    this.telemetry.frameCount++;
    this.telemetry.lastCaptureTime = Date.now();
    this.telemetry.sensorTempC = Number((38.0 + Math.sin(Date.now() / 15000) * 1.8).toFixed(1));

    // FPS calculation
    this.framesSinceLastSec++;
    const now = performance.now();
    if (now - this.lastFpsTimestamp >= 1000) {
      this.telemetry.fps = this.framesSinceLastSec;
      this.framesSinceLastSec = 0;
      this.lastFpsTimestamp = now;
    }

    // Broadcast to UI and Standalone Monitor
    this.listeners.forEach(cb => cb(this.displayCanvas, this.telemetry, this.latestResult));
  }

  /**
   * Generates realistic machine-vision feed based on selected filterMode
   */
  private processSensorDisplayImage(rawImgData: ImageData) {
    const res = IndustrialVisionSensor.RESOLUTION;
    const ctx = this.displayCtx;
    const mode = this.settings.filterMode;

    ctx.clearRect(0, 0, res, res);

    if (mode === 'RAW_COLOR' || mode === 'EDGE_INSPECTION') {
      ctx.putImageData(rawImgData, 0, 0);
    } else {
      // Monochrome / Industrial CMOS conversion
      const processed = ctx.createImageData(res, res);
      const raw = rawImgData.data;
      const out = processed.data;
      const gain = this.settings.gain;

      for (let i = 0; i < raw.length; i += 4) {
        let r = raw[i];
        let g = raw[i + 1];
        let b = raw[i + 2];

        // Standard rec601 luminance
        let luma = 0.299 * r + 0.587 * g + 0.114 * b;
        luma = Math.min(255, luma * gain);

        if (mode === 'BINARY_MASK') {
          // Binarized mask (defect < 105)
          const val = luma < 105 ? 255 : 0;
          out[i] = val;
          out[i + 1] = val === 255 ? 50 : 0;
          out[i + 2] = val === 255 ? 50 : 0;
          out[i + 3] = 255;
        } else {
          // Monochrome CMOS + subtle sensor grain
          const noise = (Math.random() - 0.5) * 4;
          const val = Math.max(0, Math.min(255, luma + noise));
          out[i] = val;
          out[i + 1] = val;
          out[i + 2] = val;
          out[i + 3] = 255;
        }
      }
      ctx.putImageData(processed, 0, 0);
    }

    // Draw Sensor OSD Overlays (Crosshairs, Grid, Defect Bounding Box)
    if (this.settings.showOverlay) {
      this.drawSensorOSD(ctx, res);
    }
  }

  /**
   * Draws industrial heads-up display (OSD) on sensor feed
   */
  private drawSensorOSD(ctx: CanvasRenderingContext2D, res: number) {
    const cx = res / 2;
    const cy = res / 2;

    // Crosshairs
    if (this.settings.showCrosshair) {
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, res);
      ctx.moveTo(0, cy);
      ctx.lineTo(res, cy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Center reticle
      ctx.strokeStyle = '#00f0ff';
      ctx.strokeRect(cx - 16, cy - 16, 32, 32);
    }

    // Inspection ROI box (Target Workpiece Zone)
    const roiMargin = Math.round(res * 0.12);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(roiMargin, roiMargin, res - roiMargin * 2, res - roiMargin * 2);

    // Two-Stage Detection Overlays
    if (this.latestResult) {
      const scale = res / 512;

      // STAGE 1: Metal Cube Bounding Box (Cyan)
      if (this.latestResult.partBox) {
        const pb = this.latestResult.partBox;
        const px = Math.round(pb.x * scale);
        const py = Math.round(pb.y * scale);
        const pw = Math.round(pb.width * scale);
        const ph = Math.round(pb.height * scale);

        ctx.save();
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 2]);
        ctx.strokeRect(px, py, pw, ph);
        ctx.setLineDash([]);

        // Stage 1 Tag
        ctx.fillStyle = 'rgba(0, 240, 255, 0.9)';
        ctx.fillRect(px, Math.max(0, py - 14), 72, 12);
        ctx.fillStyle = '#0a0f1a';
        ctx.font = 'bold 8px monospace';
        ctx.fillText('[1] METAL CUBE', px + 3, Math.max(9, py - 5));
        ctx.restore();
      }

      // STAGE 2: Defect Bounding Box if detected (Red)
      if (this.latestResult.defectInfo) {
        const d = this.latestResult.defectInfo;
        const dx = Math.round(d.x * scale);
        const dy = Math.round(d.y * scale);
        const dw = Math.round(d.width * scale);
        const dh = Math.round(d.height * scale);

        ctx.save();
        ctx.strokeStyle = '#ef4444'; // Red alarm
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 6;
        ctx.strokeRect(dx, dy, dw, dh);

        // Stage 2 Label badge
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.fillRect(dx, Math.max(0, dy - 14), 85, 13);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px monospace';
        ctx.fillText(`[2] ${d.type}`, dx + 3, Math.max(9, dy - 4));
        ctx.restore();
      } else if (this.latestResult.status === 'OK') {
        // Subtle green PASS watermark
        ctx.save();
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(roiMargin + 4, roiMargin + 4, res - (roiMargin + 4) * 2, res - (roiMargin + 4) * 2);
        ctx.fillStyle = 'rgba(34, 197, 94, 0.85)';
        ctx.font = '10px monospace';
        ctx.fillText('PASS: OK', roiMargin + 8, roiMargin + 18);
        ctx.restore();
      }
    }

    // Industrial Sensor Info Bar (Top Left)
    ctx.fillStyle = 'rgba(10, 15, 25, 0.7)';
    ctx.fillRect(4, 4, 110, 36);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '9px monospace';
    ctx.fillText(`EXP: ${this.settings.exposureUs}µs`, 8, 16);
    ctx.fillText(`GAIN: ${this.settings.gain.toFixed(1)}x`, 8, 26);
    ctx.fillText(`FPS: ${this.telemetry.fps} | ${this.telemetry.sensorTempC}°C`, 8, 36);
  }

  public dispose() {
    this.renderTarget.dispose();
    this.listeners = [];
    this.cameraGroup.traverse(child => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      }
      if (child instanceof THREE.Light) {
        child.dispose?.();
      }
    });
    this.spotLights = [];
  }
}
