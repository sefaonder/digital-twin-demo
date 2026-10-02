import * as THREE from 'three';
import type { WorkpieceData, DefectInfo, DefectType } from '../../types/scada';

export interface WorkpieceObject {
  data: WorkpieceData;
  mesh: THREE.Mesh;
  topCanvas: HTMLCanvasElement;
  topTexture: THREE.CanvasTexture;
  inspected: boolean;
  diverted: boolean;
  despawned: boolean;
}

export class WorkpieceManager {
  private workpieces: WorkpieceObject[] = [];
  private scene: THREE.Scene;
  private boxGeometry: THREE.BoxGeometry;
  private nextSerial = 1001;
  private forceNextDefect = false;

  // Physical dimensions of workpiece
  public static readonly SIZE = 0.9;
  public static readonly SPAWN_X = -7.7; // Deep inside the hollow infeed feeder machine chamber
  public static readonly CONVEYOR_Y = 0.95; // Resting on conveyor belt

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.boxGeometry = new THREE.BoxGeometry(
      WorkpieceManager.SIZE,
      WorkpieceManager.SIZE * 0.7,
      WorkpieceManager.SIZE
    );
  }

  public setForceDefect(force: boolean) {
    this.forceNextDefect = force;
  }

  public spawn(initialX?: number, forceDefect?: boolean): WorkpieceObject {
    const isDefective = typeof forceDefect === 'boolean'
      ? forceDefect
      : (this.forceNextDefect || Math.random() < 0.38);
    this.forceNextDefect = false;

    const id = `WP-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
    const serialNumber = `SN-2026-${this.nextSerial++}`;

    // Procedural dynamic texture for the top inspection surface
    const { canvas, texture, defectInfo } = this.createSurfaceTexture(isDefective);

    // Standard metallic materials for sides, procedural texture on TOP (+Y) face
    const sideMaterial = new THREE.MeshStandardMaterial({
      color: 0xc4cbd4, // Industrial light gray brushed steel
      metalness: 0.85,
      roughness: 0.35
    });

    const topMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      metalness: 0.8,
      roughness: 0.32
    });

    // Box materials array: [+X, -X, +Y, -Y, +Z, -Z]
    const materials = [
      sideMaterial,
      sideMaterial,
      topMaterial, // Top face
      sideMaterial,
      sideMaterial,
      sideMaterial
    ];

    const mesh = new THREE.Mesh(this.boxGeometry, materials);
    const startX = typeof initialX === 'number' ? initialX : WorkpieceManager.SPAWN_X;

    // Realistic production line variance: slight lateral position drift and angular orientation skew
    const lateralDrift = (Math.random() - 0.5) * 0.38; // +/- 0.19 across the belt
    const orientationSkew = (Math.random() - 0.5) * 0.24; // +/- 7 degrees yaw

    mesh.position.set(startX, WorkpieceManager.CONVEYOR_Y, lateralDrift);
    mesh.rotation.y = orientationSkew;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    this.scene.add(mesh);

    const wpObject: WorkpieceObject = {
      data: {
        id,
        serialNumber,
        spawnTime: Date.now(),
        status: 'PENDING',
        defectInfo,
        textureCanvas: canvas,
        hasVisualDefect: isDefective
      },
      mesh,
      topCanvas: canvas,
      topTexture: texture,
      inspected: false,
      diverted: false,
      despawned: false
    };

    this.workpieces.push(wpObject);
    return wpObject;
  }

  /**
   * Generates high-contrast metallic surface texture with procedural defects
   */
  private createSurfaceTexture(hasDefect: boolean): {
    canvas: HTMLCanvasElement;
    texture: THREE.CanvasTexture;
    defectInfo: DefectInfo | null;
  } {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Base: Uniform light brushed aluminum / metallic finish
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, 256, 256);

    // Brushed metal fine micro-scratches
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 60; i++) {
      const y = Math.random() * 256;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y + (Math.random() - 0.5) * 4);
      ctx.stroke();
    }

    // Chamfered border outline
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 248, 248);

    let defectInfo: DefectInfo | null = null;

    if (hasDefect) {
      // Pick random defect type
      const defectTypes: DefectType[] = ['SCRATCH', 'SURFACE_SPOT', 'CONTAMINATION'];
      const chosenType = defectTypes[Math.floor(Math.random() * defectTypes.length)];

      // Position within center ROI (40 to 210)
      const cx = 50 + Math.random() * 156;
      const cy = 50 + Math.random() * 156;

      ctx.save();
      ctx.fillStyle = '#1e293b'; // High-contrast dark defect
      ctx.strokeStyle = '#0f172a';

      if (chosenType === 'SCRATCH') {
        const length = 25 + Math.random() * 45;
        const angle = Math.random() * Math.PI;
        ctx.lineWidth = 3 + Math.random() * 2;
        ctx.beginPath();
        ctx.moveTo(cx - (Math.cos(angle) * length) / 2, cy - (Math.sin(angle) * length) / 2);
        ctx.lineTo(cx + (Math.cos(angle) * length) / 2, cy + (Math.sin(angle) * length) / 2);
        ctx.stroke();

        defectInfo = {
          type: 'SCRATCH',
          x: Math.round(cx - length / 2),
          y: Math.round(cy - 6),
          width: Math.round(length),
          height: 12,
          area: Math.round(length * 4),
          severity: length > 40 ? 'HIGH' : 'MEDIUM'
        };
      } else if (chosenType === 'SURFACE_SPOT') {
        const radius = 6 + Math.random() * 9;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        // Secondary small satellite spot
        ctx.beginPath();
        ctx.arc(cx + radius * 0.9, cy + radius * 0.7, radius * 0.45, 0, Math.PI * 2);
        ctx.fill();

        const area = Math.round(Math.PI * radius * radius);
        defectInfo = {
          type: 'SURFACE_SPOT',
          x: Math.round(cx - radius),
          y: Math.round(cy - radius),
          width: Math.round(radius * 2.2),
          height: Math.round(radius * 2.2),
          area,
          severity: radius > 10 ? 'HIGH' : 'MEDIUM'
        };
      } else {
        // Contamination blob
        ctx.beginPath();
        ctx.ellipse(cx, cy, 14, 8, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();

        defectInfo = {
          type: 'CONTAMINATION',
          x: Math.round(cx - 15),
          y: Math.round(cy - 10),
          width: 30,
          height: 20,
          area: 160,
          severity: 'HIGH'
        };
      }
      ctx.restore();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    return { canvas, texture, defectInfo };
  }

  public getWorkpieces(): WorkpieceObject[] {
    return this.workpieces;
  }

  public removeWorkpiece(wp: WorkpieceObject) {
    this.scene.remove(wp.mesh);
    // Dispose geometry/materials/textures to avoid GPU leaks
    wp.topTexture.dispose();
    if (Array.isArray(wp.mesh.material)) {
      wp.mesh.material.forEach(m => m.dispose());
    } else {
      wp.mesh.material.dispose();
    }
    wp.despawned = true;
    this.workpieces = this.workpieces.filter(w => w !== wp);
  }

  public clearAll() {
    this.workpieces.forEach(wp => {
      this.scene.remove(wp.mesh);
      wp.topTexture.dispose();
      if (Array.isArray(wp.mesh.material)) {
        wp.mesh.material.forEach(m => m.dispose());
      } else {
        wp.mesh.material.dispose();
      }
      wp.despawned = true;
    });
    this.workpieces = [];
  }

  public dispose() {
    this.clearAll();
    this.boxGeometry.dispose();
  }
}
