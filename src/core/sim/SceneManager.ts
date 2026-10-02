import * as THREE from 'three';
import { ConveyorSystem } from './ConveyorSystem';
import { WorkpieceManager, type WorkpieceObject } from './WorkpieceManager';
import { ActuatorPiston } from './ActuatorPiston';
import { IndustrialVisionSensor } from '../sensor/IndustrialVisionSensor';
import { DefectDetector } from '../vision/DefectDetector';
import type { InspectionResult, ProductionTelemetry, LogEvent, DefectSnapshotRecord } from '../../types/scada';

export interface SceneCallbacks {
  onInspection: (result: InspectionResult) => void;
  onTelemetryUpdate: (telemetry: Partial<ProductionTelemetry>) => void;
  onLogEvent: (event: Omit<LogEvent, 'id' | 'timestamp'>) => void;
  onDefectSnapshot?: (record: DefectSnapshotRecord) => void;
}

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  public conveyor: ConveyorSystem;
  public workpieceManager: WorkpieceManager;
  public piston: ActuatorPiston;
  public visionSensor: IndustrialVisionSensor;

  private isRunning = true;
  private isEstopActive = false;
  private conveyorSpeed = 2.4; // m/s
  private spawnInterval = 2.4; // seconds between parts
  private timeSinceLastSpawn = 1.8;

  // Telemetry aggregates
  private totalInspected = 0;
  private passedCount = 0;
  private rejectedCount = 0;
  private latencies: number[] = [];

  private callbacks: SceneCallbacks;
  private animationFrameId: number | null = null;
  private lastTime = performance.now();

  // Mouse camera control state
  private isMouseDown = false;
  private prevMouseX = 0;
  private prevMouseY = 0;
  private spherical = { radius: 14, theta: Math.PI / 4, phi: Math.PI / 3 };

  // DOM Event Handlers for clean detachment
  private containerElement!: HTMLDivElement;
  private onMouseDownHandler!: (e: MouseEvent) => void;
  private onMouseMoveHandler!: (e: MouseEvent) => void;
  private onMouseUpHandler!: () => void;
  private onWheelHandler!: (e: WheelEvent) => void;
  private onContextLostHandler!: (e: Event) => void;
  private onContextRestoredHandler!: () => void;

  constructor(container: HTMLDivElement, callbacks: SceneCallbacks) {
    this.callbacks = callbacks;

    // Purge any lingering children in container
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // 1. Scene & Environment - Bright Modern Smart-Factory Workshop
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf1f5f9); // Clean engineering bright gray
    this.scene.fog = new THREE.FogExp2(0xf1f5f9, 0.014);

    // 2. Camera (Isometric Industrial View)
    const initialWidth = container.clientWidth || 800;
    const initialHeight = container.clientHeight || 500;
    const aspect = initialWidth / initialHeight;
    this.camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 100);
    this.updateCameraPosition();

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(initialWidth, initialHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';

    container.appendChild(this.renderer.domElement);

    // 4. Lighting & Floor
    this.setupLighting();
    this.buildIndustrialFloor();

    // 5. Systems
    this.conveyor = new ConveyorSystem();
    this.scene.add(this.conveyor.group);

    this.workpieceManager = new WorkpieceManager(this.scene);
    // Pre-populate line with 2 active workpieces so line is moving instantly
    this.workpieceManager.spawn(-1.8, true);
    this.workpieceManager.spawn(-4.6, false);

    this.piston = new ActuatorPiston();
    this.scene.add(this.piston.group);

    this.visionSensor = new IndustrialVisionSensor();
    this.scene.add(this.visionSensor.cameraGroup);

    // 6. User Orbit Controls
    this.setupMouseControls(container);

    // Start Simulation Loop
    this.startLoop();
  }

  private setupLighting() {
    // Ambient soft factory lighting (Daylight 5500K equivalent)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
    this.scene.add(ambientLight);

    // Main Overhead Directional Light (Industrial Ceiling High-Bay Luminaire)
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.4);
    dirLight.position.set(8, 14, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 30;
    dirLight.shadow.camera.left = -10;
    dirLight.shadow.camera.right = 10;
    dirLight.shadow.camera.top = 10;
    dirLight.shadow.camera.bottom = -10;
    dirLight.shadow.bias = -0.0004;
    this.scene.add(dirLight);

    // Soft fill light from opposite quadrant
    const fillLight = new THREE.DirectionalLight(0xb0c4de, 0.9);
    fillLight.position.set(-8, 7, -8);
    this.scene.add(fillLight);
  }

  private buildIndustrialFloor() {
    // Factory Technical Blueprint Grid (Clean Engineering Slate & Sky Blue)
    const grid = new THREE.GridHelper(32, 32, 0x0284c7, 0xcbd5e1);
    grid.position.y = -0.01;
    this.scene.add(grid);

    // Clean White/Light-Gray Polished Industrial Epoxy Workshop Floor
    const floorGeo = new THREE.PlaneGeometry(42, 42);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.3,
      metalness: 0.08
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Industrial Safety Striped Hazard Perimeter around Sorting Diverter
    const stripeCanvas = document.createElement('canvas');
    stripeCanvas.width = 128;
    stripeCanvas.height = 128;
    const sctx = stripeCanvas.getContext('2d')!;
    sctx.fillStyle = '#0f172a';
    sctx.fillRect(0, 0, 128, 128);
    sctx.fillStyle = '#eab308'; // Warning Yellow
    sctx.beginPath();
    sctx.moveTo(0, 0);
    sctx.lineTo(64, 0);
    sctx.lineTo(0, 64);
    sctx.fill();
    sctx.beginPath();
    sctx.moveTo(64, 0);
    sctx.lineTo(128, 0);
    sctx.lineTo(0, 128);
    sctx.lineTo(0, 64);
    sctx.fill();
    sctx.beginPath();
    sctx.moveTo(128, 64);
    sctx.lineTo(128, 128);
    sctx.lineTo(64, 128);
    sctx.fill();

    const stripeTexture = new THREE.CanvasTexture(stripeCanvas);
    stripeTexture.wrapS = THREE.RepeatWrapping;
    stripeTexture.wrapT = THREE.RepeatWrapping;
    stripeTexture.repeat.set(4, 2);

    const safetyGeo = new THREE.PlaneGeometry(3.6, 2.2);
    const safetyMat = new THREE.MeshBasicMaterial({ map: stripeTexture, opacity: 0.25, transparent: true });
    const safetyZone = new THREE.Mesh(safetyGeo, safetyMat);
    safetyZone.rotation.x = -Math.PI / 2;
    safetyZone.position.set(2.5, 0.01, 1.2);
    this.scene.add(safetyZone);
  }

  private updateCameraPosition() {
    this.camera.position.x = this.spherical.radius * Math.sin(this.spherical.phi) * Math.cos(this.spherical.theta);
    this.camera.position.y = this.spherical.radius * Math.cos(this.spherical.phi);
    this.camera.position.z = this.spherical.radius * Math.sin(this.spherical.phi) * Math.sin(this.spherical.theta);
    this.camera.lookAt(0, 0.9, 0.6);
  }

  private setupMouseControls(container: HTMLDivElement) {
    this.containerElement = container;

    this.onMouseDownHandler = (e: MouseEvent) => {
      this.isMouseDown = true;
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;
    };

    this.onMouseMoveHandler = (e: MouseEvent) => {
      if (!this.isMouseDown) return;
      const dx = e.clientX - this.prevMouseX;
      const dy = e.clientY - this.prevMouseY;

      this.spherical.theta -= dx * 0.008;
      this.spherical.phi = Math.max(0.15, Math.min(Math.PI / 2.1, this.spherical.phi - dy * 0.008));

      this.updateCameraPosition();
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;
    };

    this.onMouseUpHandler = () => {
      this.isMouseDown = false;
    };

    this.onWheelHandler = (e: WheelEvent) => {
      e.preventDefault();
      this.spherical.radius = Math.max(5, Math.min(26, this.spherical.radius + e.deltaY * 0.012));
      this.updateCameraPosition();
    };

    this.onContextLostHandler = (e: Event) => {
      e.preventDefault();
      console.warn('[SceneManager] WebGL context lost. Pausing render loop.');
      this.stopLoop();
    };

    this.onContextRestoredHandler = () => {
      console.info('[SceneManager] WebGL context restored. Resuming render loop.');
      this.startLoop();
    };

    container.addEventListener('mousedown', this.onMouseDownHandler);
    window.addEventListener('mousemove', this.onMouseMoveHandler);
    window.addEventListener('mouseup', this.onMouseUpHandler);
    container.addEventListener('wheel', this.onWheelHandler, { passive: false });

    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLostHandler);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestoredHandler);
  }

  public handleResize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // Simulation Controls
  public setConveyorSpeed(speed: number) {
    this.conveyorSpeed = speed;
  }

  public setRunning(running: boolean) {
    this.isRunning = running;
    this.callbacks.onLogEvent({
      type: 'INFO',
      message: running ? 'Conveyor line started' : 'Conveyor line paused'
    });
  }

  public triggerEstop() {
    this.isEstopActive = !this.isEstopActive;
    this.callbacks.onLogEvent({
      type: 'ALARM',
      message: this.isEstopActive ? 'EMERGENCY STOP (E-STOP) ACTIVATED' : 'E-STOP Reset - Standby',
      details: 'All actuators and line drives halted immediately.'
    });
  }

  public forceNextDefect() {
    this.workpieceManager.setForceDefect(true);
    this.callbacks.onLogEvent({
      type: 'INFO',
      message: 'Operator queued intentional defect workpiece'
    });
  }

  public setViewPreset(preset: 'ISOMETRIC' | 'TOP_DOWN' | 'DIVERTER') {
    if (preset === 'ISOMETRIC') {
      this.spherical = { radius: 14, theta: Math.PI / 4, phi: Math.PI / 3 };
    } else if (preset === 'TOP_DOWN') {
      this.spherical = { radius: 10, theta: 0.001, phi: 0.05 };
    } else if (preset === 'DIVERTER') {
      this.spherical = { radius: 7.5, theta: 1.2, phi: 0.9 };
    }
    this.updateCameraPosition();
  }

  /**
   * Main High-Speed Physical & Optical Simulation Tick
   */
  private tick = () => {
    this.animationFrameId = requestAnimationFrame(this.tick);

    const now = performance.now();
    const delta = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    const effectiveSpeed = (this.isRunning && !this.isEstopActive) ? this.conveyorSpeed : 0;

    // 1. Update Conveyor belt textures & piston animation
    this.conveyor.updateBeltAnimation(effectiveSpeed, delta);
    this.piston.update(delta);

    // 2. Continuous or trigger-based Virtual Camera capture
    // When a workpiece is in inspection zone, capture every frame
    this.visionSensor.captureFrame(this.renderer, this.scene);

    if (effectiveSpeed > 0) {
      // 3. Periodic Workpiece Spawning
      this.timeSinceLastSpawn += delta;
      if (this.timeSinceLastSpawn >= this.spawnInterval) {
        this.timeSinceLastSpawn = 0;
        const newPart = this.workpieceManager.spawn();
        this.callbacks.onLogEvent({
          type: 'INFO',
          message: `Workpiece ${newPart.data.serialNumber} introduced to conveyor`
        });
      }

      // 4. Kinematics of Active Workpieces
      let anyPartAtSensor = false;
      const workpieces = this.workpieceManager.getWorkpieces();

      for (const wp of [...workpieces]) {
        const mesh = wp.mesh;

        if (wp.diverted) {
          const paddleFrontZ = this.piston.getPaddleFaceZ();
          const cubeHalfDepth = WorkpieceManager.SIZE / 2;

          // 1. High-Speed Pneumatic Push across main belt towards roller chute entrance (Z: 0 -> 0.95)
          if (mesh.position.z < 0.95) {
            mesh.position.x = ActuatorPiston.PISTON_X; // Aligned directly with diverter piston

            // Physically coupled push: Pusher paddle front face carries the workpiece forward
            if (paddleFrontZ >= mesh.position.z - cubeHalfDepth) {
              mesh.position.z = paddleFrontZ + cubeHalfDepth;
            } else {
              // Fast transition stroke sync
              mesh.position.z += 9.5 * delta;
            }

            // Smooth transition from conveyor belt height (0.95) to roller top entry height (0.937)
            const pushProgress = Math.min(1, Math.max(0, mesh.position.z / 0.95));
            mesh.position.y = 0.95 - pushProgress * 0.013;
            mesh.rotation.y *= 0.82; // Square up against the flat Delrin pusher face
          } else {
            // 2. Gravitational Slide directly ON TOP of the Inclined Cylindrical Roller Spur (Z: 0.95 -> 6.35)
            const rollerStart = 0.95;
            const rollerEnd = 6.35;
            const rollerProgress = Math.min(1, Math.max(0, (mesh.position.z - rollerStart) / (rollerEnd - rollerStart)));

            // Gravitational speed accelerates smoothly down the incline
            mesh.position.z += (effectiveSpeed * 1.4 + rollerProgress * 1.6) * delta;

            // Rollers axis goes from Y = 0.58 down to Y = 0.16. Roller radius is 0.042. Workpiece half-height is 0.315.
            // Exactly on top of roller surface: roller_axis_y + 0.042 + 0.315 = roller_axis_y + 0.357
            const rollerAxisY = 0.58 - rollerProgress * (0.58 - 0.16);
            mesh.position.y = rollerAxisY + 0.357;
            mesh.rotation.x = 0.076; // Match the downward tilt angle of the inclined roller spur

            // 3. Smoothly enter inside the hollow Scrap Quarantine Machine intake portal (Z >= 6.35)
            if (mesh.position.z >= rollerEnd) {
              mesh.position.z += (effectiveSpeed * 1.25) * delta;
              // Slide down internal receiving ramp inside the dark chamber
              mesh.position.y = Math.max(0.25, mesh.position.y - delta * 0.45);

              // Inside the dark hollow chamber cavity (Z >= 6.85):
              // Disappear into the internal shadows and be completely deleted from the scene!
              if (mesh.position.z >= 6.85) {
                this.workpieceManager.removeWorkpiece(wp);
                this.callbacks.onLogEvent({
                  type: 'DEFECT',
                  message: `Defective workpiece ${wp.data.serialNumber} safely collected inside Scrap & Quarantine Cell`
                });
              }
            }
          }
        } else {
          // Travel along Main Line (+X direction)
          mesh.position.x += effectiveSpeed * delta;

          // Check Photoeye Inspection Zone Trigger (around X = 0)
          const distToSensor = Math.abs(mesh.position.x - ConveyorSystem.PHOTOEYE_X);
          if (distToSensor < 0.45) {
            anyPartAtSensor = true;
          }

          // Trigger Inspection once workpiece reaches photoeye center
          if (!wp.inspected && mesh.position.x >= ConveyorSystem.PHOTOEYE_X - 0.05) {
            wp.inspected = true;
            this.executeInspection(wp);
          }

          // Diverter Piston Action: Trigger when NOK part reaches piston center (X = ActuatorPiston.PISTON_X = 3.8)
          if (wp.data.status === 'NOK' && !wp.diverted) {
            if (mesh.position.x >= ActuatorPiston.PISTON_X - 0.08) {
              this.piston.trigger();
              wp.diverted = true;
              mesh.position.x = ActuatorPiston.PISTON_X; // Snap squarely to diverter axis
              this.callbacks.onLogEvent({
                type: 'DEFECT',
                message: `Diverter actuated: Defective ${wp.data.serialNumber} diverted to gravity roller line`
              });
            }
          }

          // Successfully completed main line: enter into outfeed packaging gateway through curtains
          // Disappear inside the dark hollow packaging tunnel cavity and delete from scene
          if (mesh.position.x >= 7.15) {
            this.workpieceManager.removeWorkpiece(wp);
          }
        }

        // Safety fallback cleanup: completely purge any workpiece that strays outside line boundaries
        if (mesh.position.y < -0.8 || mesh.position.z > 8.5 || mesh.position.x > 8.5) {
          this.workpieceManager.removeWorkpiece(wp);
        }
      }

      this.conveyor.setPhotoeyeActive(anyPartAtSensor);
    }

    // Render 3D Scene
    this.renderer.render(this.scene, this.camera);
  };

  /**
   * Executes high-resolution optical inspection via OpenCV.js / fallback
   */
  private executeInspection(wp: WorkpieceObject) {
    this.visionSensor.setTriggerStatus('TRIGGERED');

    // Create high-resolution camera inspection frame (conveyor belt + metallic cube + surface texture)
    const inspectionFrame = this.visionSensor.createInspectionFrame(
      wp.topCanvas,
      wp.mesh.position.z,
      wp.mesh.rotation.y
    );

    // Run Two-Stage Defect Detection (Stage 1: Part Localization, Stage 2: Defect Localization)
    const result = DefectDetector.inspect(
      inspectionFrame,
      wp.data.id,
      wp.data.serialNumber
    );

    wp.data.status = result.status;
    wp.data.defectInfo = result.defectInfo;

    // Send latest result to sensor display overlay
    this.visionSensor.setLatestResult(result);

    // Update Telemetry
    this.totalInspected++;
    if (result.status === 'OK') {
      this.passedCount++;
    } else {
      this.rejectedCount++;
    }

    this.latencies.push(result.latencyMs);
    if (this.latencies.length > 50) this.latencies.shift();

    const avgLatency = Number(
      (this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length).toFixed(2)
    );

    const yieldRate = Number(((this.passedCount / this.totalInspected) * 100).toFixed(1));
    const defectRate = Number(((this.rejectedCount / this.totalInspected) * 100).toFixed(1));

    // Notify UI Callbacks
    this.callbacks.onInspection(result);
    this.callbacks.onTelemetryUpdate({
      totalInspected: this.totalInspected,
      passedCount: this.passedCount,
      rejectedCount: this.rejectedCount,
      yieldRate,
      defectRate,
      lastLatencyMs: result.latencyMs,
      avgLatencyMs: avgLatency,
      activePartsInSystem: this.workpieceManager.getWorkpieces().length
    });

    if (result.status === 'OK') {
      this.callbacks.onLogEvent({
        type: 'PASS',
        message: `PART PASSED: ${wp.data.serialNumber}`,
        details: `Surface uniform. Latency: ${result.latencyMs}ms (${result.engineUsed})`
      });
    } else {
      const d = result.defectInfo!;
      const pb = result.partBox;

      // Construct DefectSnapshotRecord for the defect gallery & download
      if (result.annotatedImageUrl && result.rawImageUrl && pb) {
        const record: DefectSnapshotRecord = {
          id: wp.data.id,
          serialNumber: wp.data.serialNumber,
          timestamp: new Date().toLocaleTimeString(),
          timestampMs: Date.now(),
          status: 'NOK',
          defectType: d.type,
          severity: d.severity,
          partBox: pb,
          defectBox: {
            x: d.x,
            y: d.y,
            width: d.width,
            height: d.height,
            area: d.area
          },
          confidence: result.confidence,
          latencyMs: result.latencyMs,
          engineUsed: result.engineUsed,
          annotatedImageUrl: result.annotatedImageUrl,
          rawImageUrl: result.rawImageUrl
        };
        this.callbacks.onDefectSnapshot?.(record);
      }

      this.callbacks.onLogEvent({
        type: 'DEFECT',
        message: `DEFECT DETECTED: ${wp.data.serialNumber} [${d.type}]`,
        details: `Stage 1 Workpiece: [${pb?.width}x${pb?.height}px] | Stage 2 Defect: [x:${d.x}, y:${d.y}, w:${d.width}, h:${d.height}] Area: ${d.area}px`
      });
    }

    setTimeout(() => {
      this.visionSensor.setTriggerStatus('IDLE');
    }, 400);
  }

  public startLoop() {
    if (!this.animationFrameId) {
      this.lastTime = performance.now();
      this.tick();
    }
  }

  public stopLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public destroy() {
    this.stopLoop();

    // Detach mouse & wheel listeners
    if (this.containerElement) {
      this.containerElement.removeEventListener('mousedown', this.onMouseDownHandler);
      this.containerElement.removeEventListener('wheel', this.onWheelHandler);
    }
    window.removeEventListener('mousemove', this.onMouseMoveHandler);
    window.removeEventListener('mouseup', this.onMouseUpHandler);

    if (this.renderer?.domElement) {
      this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLostHandler);
      this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestoredHandler);
    }

    // Deep dispose all sub-systems
    this.conveyor.dispose();
    this.piston.dispose();
    this.workpieceManager.dispose();
    this.visionSensor.dispose();

    // Deep scene graph cleanup
    this.scene.traverse(child => {
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

    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
