import * as THREE from 'three';

export type PistonState = 'RETRACTED' | 'EXTENDING' | 'PUSHING' | 'RETRACTING';

export class ActuatorPiston {
  public group: THREE.Group;
  private rodMesh: THREE.Mesh;
  private guideRodLeft: THREE.Mesh;
  private guideRodRight: THREE.Mesh;
  private headMesh: THREE.Mesh;

  public state: PistonState = 'RETRACTED';
  private currentExtension = 0;
  private maxExtension = 2.35; // Full stroke reaching from behind rail across 1.6m belt into roller spur
  private pushVelocity = 0;
  private dwellTimer = 0;

  // Spatial location of sorting diverter: safely set back behind rear guide rail (Z=-0.84)
  public static readonly PISTON_X = 3.8;
  public static readonly PISTON_Z = -2.7; // Mount base far back
  public static readonly REST_PADDLE_Z = 1.35; // At rest, paddle sits at absolute Z = -2.7 + 1.35 = -1.35 (60cm clear of cubes!)

  private readonly ROD_LENGTH = 2.6;
  private readonly GUIDE_LENGTH = 2.4;

  constructor() {
    this.group = new THREE.Group();
    this.group.position.set(ActuatorPiston.PISTON_X, 0.95, ActuatorPiston.PISTON_Z);

    // 1. ISO Profile Heavy Pneumatic Cylinder Barrel (Festo / Rexroth Profile with Sensor T-Slots)
    const barrelGeo = new THREE.BoxGeometry(0.42, 0.42, 2.0);
    const barrelMat = new THREE.MeshStandardMaterial({
      color: 0xd8e1eb, // Anodized clear aluminum
      metalness: 0.88,
      roughness: 0.22
    });
    const barrelMesh = new THREE.Mesh(barrelGeo, barrelMat);
    barrelMesh.position.z = -0.15;
    barrelMesh.castShadow = true;
    this.group.add(barrelMesh);

    // Profile Grooves / Corner Chamfers
    const grooveGeo = new THREE.BoxGeometry(0.44, 0.06, 2.02);
    const grooveMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
    const groove = new THREE.Mesh(grooveGeo, grooveMat);
    groove.position.z = -0.15;
    this.group.add(groove);

    // Front Rod Guide End-Cap (Blue Festo Aluminum Cap)
    const frontCapGeo = new THREE.BoxGeometry(0.44, 0.44, 0.12);
    const capMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Festo Blue
      metalness: 0.75,
      roughness: 0.3
    });
    const frontCap = new THREE.Mesh(frontCapGeo, capMat);
    frontCap.position.z = 0.86;
    frontCap.castShadow = true;
    this.group.add(frontCap);

    // Rear End-Cap
    const rearCap = new THREE.Mesh(frontCapGeo, capMat);
    rearCap.position.z = -1.16;
    rearCap.castShadow = true;
    this.group.add(rearCap);

    // 2. Heavy Industrial Mounting Stanchion & Chassis Anchor
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.8,
      roughness: 0.3
    });
    const alumMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.85,
      roughness: 0.25
    });

    // Vertical Floor Stanchion Column (Bolted to floor at back)
    const stanchionColGeo = new THREE.BoxGeometry(0.14, 1.0, 0.14);
    const stanchionCol = new THREE.Mesh(stanchionColGeo, alumMat);
    stanchionCol.position.set(0, -0.48, -1.16);
    stanchionCol.castShadow = true;
    this.group.add(stanchionCol);

    // Heavy Floor Base Plate
    const basePlateGeo = new THREE.BoxGeometry(0.38, 0.06, 0.38);
    const basePlate = new THREE.Mesh(basePlateGeo, steelMat);
    basePlate.position.set(0, -0.95, -1.16);
    basePlate.castShadow = true;
    this.group.add(basePlate);

    // Cantilever Horizontal Support Arm bridging from rear stanchion forward towards conveyor frame
    const bridgeArmGeo = new THREE.BoxGeometry(0.1, 0.16, 2.8);
    const bridgeArm = new THREE.Mesh(bridgeArmGeo, alumMat);
    bridgeArm.position.set(0, -0.38, 0.1);
    bridgeArm.castShadow = true;
    this.group.add(bridgeArm);

    // Chassis Rail Clamp (Parks comfortably behind the conveyor rear rail at absolute Z = -1.20)
    const railClampGeo = new THREE.BoxGeometry(0.26, 0.32, 0.16);
    const railClamp = new THREE.Mesh(railClampGeo, steelMat);
    railClamp.position.set(0, -0.38, 1.5);
    this.group.add(railClamp);

    // 3. Compact Pneumatic Solenoid Valve Block
    const manifoldGeo = new THREE.BoxGeometry(0.18, 0.24, 0.3);
    const manifoldMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7 });
    const manifold = new THREE.Mesh(manifoldGeo, manifoldMat);
    manifold.position.set(0.32, -0.25, -0.6);
    this.group.add(manifold);

    // Dual Flush-Mount Magnetic Cylinder Sensors with Green LED
    const proxMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.85
    });
    const proxGeo = new THREE.BoxGeometry(0.04, 0.04, 0.08);
    const proxHome = new THREE.Mesh(proxGeo, proxMat);
    proxHome.position.set(0.22, 0.16, -0.9);
    const proxExt = new THREE.Mesh(proxGeo, proxMat);
    proxExt.position.set(0.22, 0.16, 0.7);
    this.group.add(proxHome, proxExt);

    // 4. Hard Chrome Main Piston Rod (Telescopes out of barrel front cap into paddle yoke)
    const rodMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.98,
      roughness: 0.04
    });
    const rodGeo = new THREE.CylinderGeometry(0.075, 0.075, this.ROD_LENGTH, 20);
    this.rodMesh = new THREE.Mesh(rodGeo, rodMat);
    this.rodMesh.rotation.x = Math.PI / 2;
    this.rodMesh.position.z = ActuatorPiston.REST_PADDLE_Z - this.ROD_LENGTH / 2;
    this.rodMesh.castShadow = true;
    this.group.add(this.rodMesh);

    // Dual Anti-Rotation Guide Rods (Twin-Guide Assembly)
    const guideGeo = new THREE.CylinderGeometry(0.035, 0.035, this.GUIDE_LENGTH, 16);
    this.guideRodLeft = new THREE.Mesh(guideGeo, rodMat);
    this.guideRodLeft.rotation.x = Math.PI / 2;
    this.guideRodLeft.position.set(-0.16, 0, ActuatorPiston.REST_PADDLE_Z - this.GUIDE_LENGTH / 2);
    this.guideRodLeft.castShadow = true;
    this.group.add(this.guideRodLeft);

    this.guideRodRight = new THREE.Mesh(guideGeo, rodMat);
    this.guideRodRight.rotation.x = Math.PI / 2;
    this.guideRodRight.position.set(0.16, 0, ActuatorPiston.REST_PADDLE_Z - this.GUIDE_LENGTH / 2);
    this.guideRodRight.castShadow = true;
    this.group.add(this.guideRodRight);

    // 5. Heavy-Duty Diverter Pusher Paddle (Delrin + Polyurethane Bumper)
    const paddleGroup = new THREE.Group();

    // Aluminum Yoke Flange connecting the 3 rods
    const yokeGeo = new THREE.BoxGeometry(0.5, 0.22, 0.08);
    const yoke = new THREE.Mesh(yokeGeo, capMat);
    paddleGroup.add(yoke);

    // Industrial Delrin Pusher Paddle with Chamfered Entry
    const headGeo = new THREE.BoxGeometry(0.92, 0.38, 0.09);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Festo Blue
      roughness: 0.35,
      metalness: 0.3
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.z = 0.07;
    head.castShadow = true;
    paddleGroup.add(head);

    // White Low-Friction Contact Face Plate
    const faceGeo = new THREE.BoxGeometry(0.88, 0.34, 0.02);
    const faceMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.z = 0.12;
    paddleGroup.add(face);

    this.headMesh = paddleGroup as unknown as THREE.Mesh;
    // At rest, headMesh is at REST_PADDLE_Z (Absolute Z = -2.7 + 1.35 = -1.35)
    this.headMesh.position.z = ActuatorPiston.REST_PADDLE_Z;
    this.group.add(this.headMesh);
  }

  public trigger() {
    if (this.state === 'RETRACTED') {
      this.state = 'EXTENDING';
      this.pushVelocity = 12.0; // High-speed pneumatic stroke across the line
    }
  }

  public isBusy(): boolean {
    return this.state !== 'RETRACTED';
  }

  public getExtension(): number {
    return this.currentExtension;
  }

  /**
   * Absolute world Z coordinate of the pusher paddle contact face
   */
  public getPaddleFaceZ(): number {
    return ActuatorPiston.PISTON_Z + ActuatorPiston.REST_PADDLE_Z + this.currentExtension + 0.13;
  }

  /**
   * Authentic non-linear pneumatic cylinder stroke curve with dwell and air cushioning
   */
  public update(delta: number) {
    if (this.state === 'EXTENDING') {
      // Rapid pneumatic expansion with end-of-stroke air cushioning
      const progress = this.currentExtension / this.maxExtension;
      const speedFactor = Math.max(0.35, 1.0 - Math.pow(progress, 3));
      this.currentExtension += this.pushVelocity * speedFactor * delta;

      if (this.currentExtension >= this.maxExtension) {
        this.currentExtension = this.maxExtension;
        this.state = 'PUSHING';
        this.dwellTimer = 0.06; // Short kinetic dwell at full stroke
      }
    } else if (this.state === 'PUSHING') {
      this.dwellTimer -= delta;
      if (this.dwellTimer <= 0) {
        this.state = 'RETRACTING';
      }
    } else if (this.state === 'RETRACTING') {
      // Smooth pneumatic return stroke with soft landing at home
      const retractSpeed = 6.5;
      this.currentExtension -= retractSpeed * delta;
      if (this.currentExtension <= 0) {
        this.currentExtension = 0;
        this.state = 'RETRACTED';
      }
    }

    const currentPaddleZ = ActuatorPiston.REST_PADDLE_Z + this.currentExtension;
    this.headMesh.position.z = currentPaddleZ;
    this.rodMesh.position.z = currentPaddleZ - this.ROD_LENGTH / 2;
    this.guideRodLeft.position.z = currentPaddleZ - this.GUIDE_LENGTH / 2;
    this.guideRodRight.position.z = currentPaddleZ - this.GUIDE_LENGTH / 2;
  }

  public dispose() {
    this.group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      }
    });
  }
}

