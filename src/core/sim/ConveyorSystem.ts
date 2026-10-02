import * as THREE from 'three';
import { ActuatorPiston } from './ActuatorPiston';

export class ConveyorSystem {
  public group: THREE.Group;
  private mainBeltTexture: THREE.CanvasTexture;
  private rollerTexture: THREE.CanvasTexture;
  public photoeyeLaserMesh: THREE.Mesh;
  private photoeyeIndicatorLight: THREE.PointLight;
  private rollerMeshes: THREE.Mesh[] = [];

  public static readonly MAIN_LENGTH = 16;
  public static readonly BELT_WIDTH = 1.6;
  public static readonly PHOTOEYE_X = 0; // Triggers when workpiece reaches inspection center

  constructor() {
    this.group = new THREE.Group();

    this.mainBeltTexture = this.createBeltTexture();
    this.rollerTexture = this.createRollerTexture();

    this.buildMainConveyor();
    this.buildInclinedGravityRollerSpur();
    this.buildScrapQuarantineStation();

    const { laserMesh, light } = this.buildPhotoeyeSensor();
    this.photoeyeLaserMesh = laserMesh;
    this.photoeyeIndicatorLight = light;

    // Realistic Infeed Feeder Enclosure (CNC / Workpiece Emitter Cell)
    this.buildInfeedFeederMachine();

    // Realistic Outfeed Packaging Tunnel (Next Station Gateway)
    this.buildOutfeedPackagingTunnel();
  }

  /**
   * Generates authentic high-grade industrial PVC conveyor texture with diamond grip and tracking seams
   */
  private createBeltTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Classic Industrial Habasit/Siegling PVC Green (RAL 6002 Leaf Green / Conveyor Green)
    ctx.fillStyle = '#225237';
    ctx.fillRect(0, 0, 128, 128);

    // Embossed diamond/cross-hatch grip micro-pattern
    ctx.strokeStyle = '#2d6846';
    ctx.lineWidth = 1.5;
    for (let i = -128; i < 256; i += 16) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 128, 128);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(i + 128, 0);
      ctx.lineTo(i, 128);
      ctx.stroke();
    }

    // Longitudinal tracking ribs (v-guide grooves)
    ctx.strokeStyle = '#183b27';
    ctx.lineWidth = 3;
    [16, 112].forEach(y => {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(128, y);
      ctx.stroke();
    });

    // High-visibility dashed tracking center line
    ctx.strokeStyle = '#489467';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(0, 64);
    ctx.lineTo(128, 64);
    ctx.stroke();
    ctx.setLineDash([]);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16, 1);
    return texture;
  }

  /**
   * Generates high-contrast striped roller texture with rubber traction rings
   * and longitudinal alignment indicators to make roller spin 100% visible
   */
  private createRollerTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Polished stainless steel / chrome base
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, 128, 64);

    // Subtle horizontal brushed metal grain
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    for (let y = 0; y < 64; y += 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(128, y);
      ctx.stroke();
    }

    // High-contrast black rubber drive bands (dual O-rings for visual traction)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(20, 0, 14, 64);
    ctx.fillRect(94, 0, 14, 64);

    // Bold longitudinal rotation indicator lines (makes spinning 100% visible!)
    ctx.fillStyle = '#0284c7'; // Electric blue stripe
    ctx.fillRect(0, 0, 128, 9);
    ctx.fillStyle = '#f59e0b'; // Amber stripe at opposite side
    ctx.fillRect(0, 32, 128, 9);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  private buildMainConveyor() {
    // 1. Conveyor Belt Deck
    const beltGeo = new THREE.BoxGeometry(ConveyorSystem.MAIN_LENGTH, 0.16, ConveyorSystem.BELT_WIDTH);
    const beltMat = new THREE.MeshStandardMaterial({
      map: this.mainBeltTexture,
      roughness: 0.65,
      metalness: 0.2
    });
    const belt = new THREE.Mesh(beltGeo, beltMat);
    belt.position.set(0, 0.5, 0);
    belt.receiveShadow = true;
    this.group.add(belt);

    // 2. Extruded Anodized Aluminum Guide Rails (Rexroth / Item Profile System)
    const railMat = new THREE.MeshStandardMaterial({
      color: 0xc8d3df,
      metalness: 0.85,
      roughness: 0.22
    });

    // Wear Strips Material (UHMW-PE Low Friction Green Plastic Liners)
    const wearStripMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.4
    });

    // Back rail (interrupted at sorting spur zone)
    const backRailLeftGeo = new THREE.BoxGeometry(10.5, 0.35, 0.08);
    const backRailLeft = new THREE.Mesh(backRailLeftGeo, railMat);
    backRailLeft.position.set(-2.75, 0.72, -ConveyorSystem.BELT_WIDTH / 2 - 0.04);
    backRailLeft.castShadow = true;
    this.group.add(backRailLeft);

    const backWearLeft = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.06, 0.02), wearStripMat);
    backWearLeft.position.set(-2.75, 0.66, -ConveyorSystem.BELT_WIDTH / 2 + 0.01);
    this.group.add(backWearLeft);

    const backRailRightGeo = new THREE.BoxGeometry(3.5, 0.35, 0.08);
    const backRailRight = new THREE.Mesh(backRailRightGeo, railMat);
    backRailRight.position.set(6.25, 0.72, -ConveyorSystem.BELT_WIDTH / 2 - 0.04);
    backRailRight.castShadow = true;
    this.group.add(backRailRight);

    // Front rail (with opening at diverter zone: centered at ActuatorPiston.PISTON_X = 3.8)
    const frontRail1Geo = new THREE.BoxGeometry(11.05, 0.35, 0.08);
    const frontRail1 = new THREE.Mesh(frontRail1Geo, railMat);
    frontRail1.position.set(-2.475, 0.72, ConveyorSystem.BELT_WIDTH / 2 + 0.04);
    frontRail1.castShadow = true;
    this.group.add(frontRail1);

    const frontWear1 = new THREE.Mesh(new THREE.BoxGeometry(11.05, 0.06, 0.02), wearStripMat);
    frontWear1.position.set(-2.475, 0.66, ConveyorSystem.BELT_WIDTH / 2 - 0.01);
    this.group.add(frontWear1);

    const frontRail2Geo = new THREE.BoxGeometry(3.45, 0.35, 0.08);
    const frontRail2 = new THREE.Mesh(frontRail2Geo, railMat);
    frontRail2.position.set(6.275, 0.72, ConveyorSystem.BELT_WIDTH / 2 + 0.04);
    frontRail2.castShadow = true;
    this.group.add(frontRail2);

    // Lower Structural Side Stringer Beams with Hazard Safety Accents
    const stringerGeo = new THREE.BoxGeometry(ConveyorSystem.MAIN_LENGTH, 0.22, 0.06);
    const darkFrameMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });
    [-ConveyorSystem.BELT_WIDTH / 2 - 0.05, ConveyorSystem.BELT_WIDTH / 2 + 0.05].forEach(z => {
      const stringer = new THREE.Mesh(stringerGeo, darkFrameMat);
      stringer.position.set(0, 0.42, z);
      this.group.add(stringer);
    });

    // 3. Conveyor End Caps (Clean enclosed transition into machines, without rotating drums inside)
    // The rotating drums inside the machines have been removed per user request.



    // 5. Heavy-Duty Support Leg Extrusions with Leveling Floor Feet
    const legPositions = [-7, -3.5, 0, 3.5, 7];
    const legGeo = new THREE.BoxGeometry(0.12, 1.0, 0.12);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 });
    const footGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12);
    const footMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9 });

    legPositions.forEach(x => {
      [-ConveyorSystem.BELT_WIDTH / 2, ConveyorSystem.BELT_WIDTH / 2].forEach(z => {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(x, 0, z);
        leg.castShadow = true;
        this.group.add(leg);

        const foot = new THREE.Mesh(footGeo, footMat);
        foot.position.set(x, -0.48, z);
        this.group.add(foot);
      });
    });
  }

  /**
   * Builds an authentic Inclined Gravity Roller Conveyor
   * Where rejected parts roll/slide smoothly down cylindrical rollers by gravity!
   */
  private buildInclinedGravityRollerSpur() {
    const spurGroup = new THREE.Group();
    // Starts at diverter edge (Z = 0.9, Y = 0.58) down to quarantine cell (Z = 6.4, Y = 0.16)
    const zStart = 0.9;
    const zEnd = 6.4;
    const yStart = 0.58;
    const yEnd = 0.16;
    const totalZ = zEnd - zStart;
    const totalDrop = yStart - yEnd;
    const angle = Math.atan2(totalDrop, totalZ); // Downward incline angle

    // Aligned to new PISTON_X (3.8)
    const spurX = ActuatorPiston.PISTON_X;
    const rollerWidth = 1.35;

    // 1. Galvanized Steel C-Channel Side Stringers (Sloped Rails)
    const railLength = Math.sqrt(totalZ * totalZ + totalDrop * totalDrop);
    const sideRailGeo = new THREE.BoxGeometry(0.06, 0.22, railLength);
    const sideRailMat = new THREE.MeshStandardMaterial({
      color: 0xb0bec5,
      metalness: 0.85,
      roughness: 0.25
    });

    [-rollerWidth / 2 - 0.04, rollerWidth / 2 + 0.04].forEach(xOffset => {
      const rail = new THREE.Mesh(sideRailGeo, sideRailMat);
      rail.position.set(spurX + xOffset, (yStart + yEnd) / 2 + 0.04, (zStart + zEnd) / 2);
      rail.rotation.x = angle; // Sloped downwards
      rail.castShadow = true;
      spurGroup.add(rail);
    });

    // 2. Parallel Cylindrical Steel Free Rollers with High-Contrast Striped Texture
    const numRollers = 20;
    const rollerRadius = 0.042;
    const rollerGeo = new THREE.CylinderGeometry(rollerRadius, rollerRadius, rollerWidth, 20);
    const rollerMat = new THREE.MeshStandardMaterial({
      map: this.rollerTexture,
      metalness: 0.88,
      roughness: 0.22
    });

    this.rollerMeshes = [];
    for (let i = 0; i < numRollers; i++) {
      const t = i / (numRollers - 1);
      const z = zStart + 0.12 + t * (totalZ - 0.24);
      const y = yStart - t * totalDrop;

      const roller = new THREE.Mesh(rollerGeo, rollerMat);
      roller.rotation.z = Math.PI / 2;
      roller.position.set(spurX, y, z);
      roller.castShadow = true;
      spurGroup.add(roller);
      this.rollerMeshes.push(roller);

      // Axle End Bearing Caps
      const axleGeo = new THREE.CylinderGeometry(0.018, 0.018, rollerWidth + 0.1, 10);
      const axleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9 });
      const axle = new THREE.Mesh(axleGeo, axleMat);
      axle.rotation.z = Math.PI / 2;
      axle.position.set(spurX, y, z);
      spurGroup.add(axle);
    }

    // 3. Adjustable Tubular Steel Support Stands along the incline
    const supportPositionsZ = [2.2, 4.3, 6.2];
    const legPipeMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.3 });

    supportPositionsZ.forEach(z => {
      const t = (z - zStart) / totalZ;
      const beamY = yStart - t * totalDrop;
      const legHeight = beamY + 0.48; // from floor Y = -0.48 up to beam

      [-rollerWidth / 2 - 0.04, rollerWidth / 2 + 0.04].forEach(xOffset => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, legHeight, 12), legPipeMat);
        leg.position.set(spurX + xOffset, beamY - legHeight / 2, z);
        leg.castShadow = true;
        spurGroup.add(leg);

        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 12), legPipeMat);
        foot.position.set(spurX + xOffset, -0.48, z);
        spurGroup.add(foot);
      });
    });

    this.group.add(spurGroup);
  }

  /**
   * Realistic Industrial Scrap & Defect Quarantine Cell (Truly Hollow, Dark Interior Machine)
   * Defective products slide through the open intake throat into the dark interior and vanish.
   */
  private buildScrapQuarantineStation() {
    const stationGroup = new THREE.Group();
    // Positioned directly at the bottom end of the roller conveyor (aligned to PISTON_X)
    stationGroup.position.set(ActuatorPiston.PISTON_X, 0, 7.3);

    // Exterior Industrial Caution Amber Material (RAL 1028 / RAL 2004)
    const amberMat = new THREE.MeshStandardMaterial({
      color: 0xd97706, // High-visibility industrial caution amber
      metalness: 0.5,
      roughness: 0.35
    });

    // Dark Interior Wall Material (Deep dark industrial steel lining that absorbs light)
    const interiorMat = new THREE.MeshStandardMaterial({
      color: 0x070b14,
      roughness: 0.95,
      metalness: 0.1
    });

    const darkTrimMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.5,
      metalness: 0.7
    });

    // 1. Truly Hollow Exterior Walls & Enclosure Panels (Leaving open receiving portal at -Z face)
    const wallThick = 0.08;
    const width = 2.0;
    const height = 2.2;
    const depth = 1.9;

    // Back Wall (+Z face)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(width, height, wallThick), amberMat);
    backWall.position.set(0, height / 2, depth / 2 - wallThick / 2);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    stationGroup.add(backWall);

    // Left Wall (-X face)
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, height, depth), amberMat);
    leftWall.position.set(-width / 2 + wallThick / 2, height / 2, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    stationGroup.add(leftWall);

    // Right Wall (+X face)
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, height, depth), amberMat);
    rightWall.position.set(width / 2 - wallThick / 2, height / 2, 0);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    stationGroup.add(rightWall);

    // Roof Panel (+Y face)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(width, wallThick, depth), amberMat);
    roof.position.set(0, height - wallThick / 2, 0);
    roof.castShadow = true;
    stationGroup.add(roof);

    // Floor Base Plate (Y = 0)
    const floor = new THREE.Mesh(new THREE.BoxGeometry(width, wallThick, depth), darkTrimMat);
    floor.position.set(0, wallThick / 2, 0);
    floor.receiveShadow = true;
    stationGroup.add(floor);

    // Front Portal Wall (-Z face, facing incoming roller conveyor):
    // Modeled with an open receiving portal (1.4m wide x 1.35m high) so cubes physically glide INSIDE
    const portalZ = -depth / 2 + wallThick / 2;
    const portalLintel = new THREE.Mesh(new THREE.BoxGeometry(width, 0.85, wallThick), amberMat);
    portalLintel.position.set(0, height - 0.85 / 2, portalZ);
    portalLintel.castShadow = true;
    stationGroup.add(portalLintel);

    const jambWidth = 0.3;
    const jambHeight = height - 0.85;
    const leftJamb = new THREE.Mesh(new THREE.BoxGeometry(jambWidth, jambHeight, wallThick), amberMat);
    leftJamb.position.set(-width / 2 + jambWidth / 2, jambHeight / 2, portalZ);
    stationGroup.add(leftJamb);

    const rightJamb = new THREE.Mesh(new THREE.BoxGeometry(jambWidth, jambHeight, wallThick), amberMat);
    rightJamb.position.set(width / 2 - jambWidth / 2, jambHeight / 2, portalZ);
    stationGroup.add(rightJamb);

    // 2. Interior Dark Cavity Lining (Creates genuine internal shadow depth)
    const innerBack = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.2, height - 0.2), interiorMat);
    innerBack.position.set(0, height / 2, depth / 2 - wallThick - 0.01);
    innerBack.rotation.y = Math.PI; // Faces inward
    stationGroup.add(innerBack);

    const innerLeft = new THREE.Mesh(new THREE.PlaneGeometry(depth - 0.2, height - 0.2), interiorMat);
    innerLeft.position.set(-width / 2 + wallThick + 0.01, height / 2, 0);
    innerLeft.rotation.y = Math.PI / 2;
    stationGroup.add(innerLeft);

    const innerRight = new THREE.Mesh(new THREE.PlaneGeometry(depth - 0.2, height - 0.2), interiorMat);
    innerRight.position.set(width / 2 - wallThick - 0.01, height / 2, 0);
    innerRight.rotation.y = -Math.PI / 2;
    stationGroup.add(innerRight);

    // 3. Sloped Internal Stainless Steel Slide Chute (Guides cubes deep into the chamber)
    const slidePlateGeo = new THREE.BoxGeometry(1.36, 0.04, 1.2);
    const stainlessSlideMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.9,
      roughness: 0.2
    });
    const slidePlate = new THREE.Mesh(slidePlateGeo, stainlessSlideMat);
    slidePlate.position.set(0, 0.32, -0.2);
    slidePlate.rotation.x = -0.32; // Slopes downward into dark interior
    slidePlate.receiveShadow = true;
    stationGroup.add(slidePlate);

    // Internal rubber damping bin at bottom of chamber
    const dampingBed = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 1.4), interiorMat);
    dampingBed.position.set(0, 0.09, 0.15);
    stationGroup.add(dampingBed);

    // 4. Subtle Internal Chamber Glow (Captures ambient light & warm status LED inside)
    const internalGlow = new THREE.PointLight(0xf59e0b, 0.45, 2.5);
    internalGlow.position.set(0, 1.6, -0.1);
    stationGroup.add(internalGlow);

    // 5. Exterior Corner Steel Protection Pillars
    const pillarGeo = new THREE.BoxGeometry(0.12, height + 0.04, 0.12);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.75, roughness: 0.3 });
    [[-width / 2, -depth / 2], [width / 2, -depth / 2], [-width / 2, depth / 2], [width / 2, depth / 2]].forEach(([px, pz]) => {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(px, height / 2, pz);
      stationGroup.add(pillar);
    });

    // 6. Hazard Safety Header Bar with Diagonal Caution Decal Trim
    const headerTrimGeo = new THREE.BoxGeometry(width + 0.04, 0.12, 0.12);
    const headerTrim = new THREE.Mesh(headerTrimGeo, darkTrimMat);
    headerTrim.position.set(0, height - 0.85, portalZ - 0.04);
    stationGroup.add(headerTrim);

    // Top Enclosure Cap Trim
    const topTrim = new THREE.Mesh(new THREE.BoxGeometry(width + 0.06, 0.1, depth + 0.06), darkTrimMat);
    topTrim.position.set(0, height + 0.05, 0);
    stationGroup.add(topTrim);

    // Amber Quarantine Warning Beacon Light Tower
    const beaconStem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 12), pillarMat);
    beaconStem.position.set(0, height + 0.2, 0.4);
    stationGroup.add(beaconStem);

    const beaconLamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.14, 12),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.9 })
    );
    beaconLamp.position.set(0, height + 0.35, 0.4);
    stationGroup.add(beaconLamp);

    // Forklift Pockets at base
    const skidGeo = new THREE.BoxGeometry(0.2, 0.1, depth + 0.1);
    [-0.6, 0.6].forEach(sx => {
      const skid = new THREE.Mesh(skidGeo, pillarMat);
      skid.position.set(sx, 0.05, 0);
      stationGroup.add(skid);
    });

    this.group.add(stationGroup);
  }

  /**
   * Realistic Infeed Feeder Machine (Truly Hollow, Dark Interior Chamber with Exit Portal)
   * Products spawn deep in the dark chamber and emerge through flexible strip curtains.
   */
  private buildInfeedFeederMachine() {
    const feederGroup = new THREE.Group();
    feederGroup.position.set(-7.4, 0, 0);

    const cabinetMat = new THREE.MeshStandardMaterial({
      color: 0xd8e1eb, // Industrial light slate gray
      metalness: 0.7,
      roughness: 0.35
    });

    const interiorMat = new THREE.MeshStandardMaterial({
      color: 0x050811, // Dark interior lining
      roughness: 0.95,
      metalness: 0.05
    });

    const darkTrimMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 }); // Siemens Blue

    const wallThick = 0.08;
    const width = 2.0; // Along X
    const height = 2.4; // Along Y
    const depth = 2.4; // Along Z

    // Back Wall (-X face)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, height, depth), cabinetMat);
    backWall.position.set(-width / 2 + wallThick / 2, height / 2, 0);
    backWall.castShadow = true;
    feederGroup.add(backWall);

    // Left Wall (+Z face)
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(width, height, wallThick), cabinetMat);
    leftWall.position.set(0, height / 2, depth / 2 - wallThick / 2);
    leftWall.castShadow = true;
    feederGroup.add(leftWall);

    // Right Wall (-Z face)
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(width, height, wallThick), cabinetMat);
    rightWall.position.set(0, height / 2, -depth / 2 + wallThick / 2);
    rightWall.castShadow = true;
    feederGroup.add(rightWall);

    // Roof Panel
    const roof = new THREE.Mesh(new THREE.BoxGeometry(width, wallThick, depth), cabinetMat);
    roof.position.set(0, height - wallThick / 2, 0);
    roof.castShadow = true;
    feederGroup.add(roof);

    // Base Floor
    const floor = new THREE.Mesh(new THREE.BoxGeometry(width, wallThick, depth), interiorMat);
    floor.position.set(0, wallThick / 2, 0);
    feederGroup.add(floor);

    // Exit Wall (+X face towards conveyor):
    // Open Exit Portal (1.5m wide x 1.45m high) so cubes emerge from dark interior
    const portalX = width / 2 - wallThick / 2;
    const portalLintel = new THREE.Mesh(new THREE.BoxGeometry(wallThick, 0.95, depth), cabinetMat);
    portalLintel.position.set(portalX, height - 0.95 / 2, 0);
    portalLintel.castShadow = true;
    feederGroup.add(portalLintel);

    const jambDepth = 0.45;
    const jambHeight = height - 0.95;
    const frontJamb = new THREE.Mesh(new THREE.BoxGeometry(wallThick, jambHeight, jambDepth), cabinetMat);
    frontJamb.position.set(portalX, jambHeight / 2, depth / 2 - jambDepth / 2);
    feederGroup.add(frontJamb);

    const backJamb = new THREE.Mesh(new THREE.BoxGeometry(wallThick, jambHeight, jambDepth), cabinetMat);
    backJamb.position.set(portalX, jambHeight / 2, -depth / 2 + jambDepth / 2);
    feederGroup.add(backJamb);

    // Dark Interior Cavity Liners
    const innerBack = new THREE.Mesh(new THREE.PlaneGeometry(depth - 0.2, height - 0.2), interiorMat);
    innerBack.position.set(-width / 2 + wallThick + 0.01, height / 2, 0);
    innerBack.rotation.y = Math.PI / 2;
    feederGroup.add(innerBack);

    // Internal Infeed Conveyor Staging Deck inside the chamber
    const deckGeo = new THREE.BoxGeometry(1.4, 0.1, 1.4);
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.3 });
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.set(0, 0.5, 0);
    feederGroup.add(deck);

    // Subtle Internal Chamber Lighting (Illuminates interior cavity with soft industrial blue)
    const interiorLight = new THREE.PointLight(0x0284c7, 0.4, 2.5);
    interiorLight.position.set(-0.2, 1.6, 0);
    feederGroup.add(interiorLight);

    // Flexible Industrial Strip Curtains (PVC Flaps) hanging across the portal
    const stripMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.6,
      transparent: true,
      opacity: 0.8
    });
    const stripWidth = 0.34;
    for (let i = 0; i < 4; i++) {
      const zOffset = -0.51 + i * stripWidth * 0.98;
      const stripGeo = new THREE.BoxGeometry(0.02, 1.1, stripWidth);
      const strip = new THREE.Mesh(stripGeo, stripMat);
      strip.position.set(portalX + 0.02, 0.95, zOffset);
      strip.rotation.z = (Math.random() - 0.5) * 0.04;
      feederGroup.add(strip);
    }

    // Top Blue Machine Header Trim
    const trim = new THREE.Mesh(new THREE.BoxGeometry(width + 0.06, 0.15, depth + 0.06), darkTrimMat);
    trim.position.set(0, height + 0.05, 0);
    feederGroup.add(trim);

    // Andon Signal Tower (Light Pole: Green Status)
    const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 12);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.9 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(0, height + 0.35, -0.8);
    feederGroup.add(pole);

    const greenLamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.12, 12),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.9 })
    );
    greenLamp.position.set(0, height + 0.6, -0.8);
    feederGroup.add(greenLamp);

    this.group.add(feederGroup);
  }

  /**
   * Outfeed Gateway / Packaging Cell Tunnel (Truly Hollow, Dark Interior Receiving Tunnel)
   * Passing products smoothly enter through strip curtains into the dark interior and vanish.
   */
  private buildOutfeedPackagingTunnel() {
    const tunnelGroup = new THREE.Group();
    tunnelGroup.position.set(7.5, 0, 0);

    const tunnelMat = new THREE.MeshStandardMaterial({
      color: 0xd8e1eb,
      metalness: 0.7,
      roughness: 0.35
    });

    const interiorMat = new THREE.MeshStandardMaterial({
      color: 0x050811, // Dark interior lining
      roughness: 0.95,
      metalness: 0.05
    });

    const darkTrimMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });

    const wallThick = 0.08;
    const width = 2.0;
    const height = 2.3;
    const depth = 2.4;

    // Back Wall (+X face)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, height, depth), tunnelMat);
    backWall.position.set(width / 2 - wallThick / 2, height / 2, 0);
    backWall.castShadow = true;
    tunnelGroup.add(backWall);

    // Left Wall (+Z face)
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(width, height, wallThick), tunnelMat);
    leftWall.position.set(0, height / 2, depth / 2 - wallThick / 2);
    leftWall.castShadow = true;
    tunnelGroup.add(leftWall);

    // Right Wall (-Z face)
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(width, height, wallThick), tunnelMat);
    rightWall.position.set(0, height / 2, -depth / 2 + wallThick / 2);
    rightWall.castShadow = true;
    tunnelGroup.add(rightWall);

    // Roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(width, wallThick, depth), tunnelMat);
    roof.position.set(0, height - wallThick / 2, 0);
    roof.castShadow = true;
    tunnelGroup.add(roof);

    // Floor
    const floor = new THREE.Mesh(new THREE.BoxGeometry(width, wallThick, depth), interiorMat);
    floor.position.set(0, wallThick / 2, 0);
    tunnelGroup.add(floor);

    // Intake Wall (-X face facing incoming conveyor):
    // Modeled with an open intake portal (1.5m wide x 1.45m high)
    const portalX = -width / 2 + wallThick / 2;
    const portalLintel = new THREE.Mesh(new THREE.BoxGeometry(wallThick, 0.85, depth), tunnelMat);
    portalLintel.position.set(portalX, height - 0.85 / 2, 0);
    portalLintel.castShadow = true;
    tunnelGroup.add(portalLintel);

    const jambDepth = 0.45;
    const jambHeight = height - 0.85;
    const frontJamb = new THREE.Mesh(new THREE.BoxGeometry(wallThick, jambHeight, jambDepth), tunnelMat);
    frontJamb.position.set(portalX, jambHeight / 2, depth / 2 - jambDepth / 2);
    tunnelGroup.add(frontJamb);

    const backJamb = new THREE.Mesh(new THREE.BoxGeometry(wallThick, jambHeight, jambDepth), tunnelMat);
    backJamb.position.set(portalX, jambHeight / 2, -depth / 2 + jambDepth / 2);
    tunnelGroup.add(backJamb);

    // Dark Interior Cavity Liners
    const innerBack = new THREE.Mesh(new THREE.PlaneGeometry(depth - 0.2, height - 0.2), interiorMat);
    innerBack.position.set(width / 2 - wallThick - 0.01, height / 2, 0);
    innerBack.rotation.y = -Math.PI / 2;
    tunnelGroup.add(innerBack);

    // Internal Conveyor Bed inside the tunnel
    const bedGeo = new THREE.BoxGeometry(1.4, 0.1, 1.4);
    const bedMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.3 });
    const bed = new THREE.Mesh(bedGeo, bedMat);
    bed.position.set(0, 0.5, 0);
    tunnelGroup.add(bed);

    // Subtle Internal Chamber Lighting (Soft emerald green glow)
    const interiorLight = new THREE.PointLight(0x10b981, 0.4, 2.5);
    interiorLight.position.set(0.2, 1.5, 0);
    tunnelGroup.add(interiorLight);

    // Flexible Industrial Strip Curtains across intake portal
    const stripMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.6,
      transparent: true,
      opacity: 0.8
    });
    const stripWidth = 0.34;
    for (let i = 0; i < 4; i++) {
      const zOffset = -0.51 + i * stripWidth * 0.98;
      const stripGeo = new THREE.BoxGeometry(0.02, 1.1, stripWidth);
      const strip = new THREE.Mesh(stripGeo, stripMat);
      strip.position.set(portalX - 0.02, 0.95, zOffset);
      strip.rotation.z = (Math.random() - 0.5) * 0.04;
      tunnelGroup.add(strip);
    }

    // Top Blue Header Trim
    const trim = new THREE.Mesh(new THREE.BoxGeometry(width + 0.06, 0.15, depth + 0.06), darkTrimMat);
    trim.position.set(0, height + 0.05, 0);
    tunnelGroup.add(trim);

    this.group.add(tunnelGroup);
  }

  private buildPhotoeyeSensor(): { laserMesh: THREE.Mesh; light: THREE.PointLight } {
    const sensorGroup = new THREE.Group();
    sensorGroup.position.set(ConveyorSystem.PHOTOEYE_X, 0.95, 0);

    // Sensor Emitter Housing (Right side)
    const housingGeo = new THREE.BoxGeometry(0.12, 0.25, 0.15);
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
    const emitter = new THREE.Mesh(housingGeo, housingMat);
    emitter.position.set(0, 0, -ConveyorSystem.BELT_WIDTH / 2 - 0.12);
    sensorGroup.add(emitter);

    // Sensor Receiver Housing (Left side)
    const receiver = new THREE.Mesh(housingGeo, housingMat);
    receiver.position.set(0, 0, ConveyorSystem.BELT_WIDTH / 2 + 0.12);
    sensorGroup.add(receiver);

    // Laser Beam Line
    const laserGeo = new THREE.CylinderGeometry(0.015, 0.015, ConveyorSystem.BELT_WIDTH + 0.24, 8);
    const laserMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e, // Green beam (Red when tripped)
      transparent: true,
      opacity: 0.75
    });
    const laserMesh = new THREE.Mesh(laserGeo, laserMat);
    laserMesh.rotation.x = Math.PI / 2;
    sensorGroup.add(laserMesh);

    // Small status indicator LED on top of sensor housing
    const light = new THREE.PointLight(0x22c55e, 1.2, 2);
    light.position.set(0, 0.18, ConveyorSystem.BELT_WIDTH / 2 + 0.12);
    sensorGroup.add(light);

    this.group.add(sensorGroup);

    return { laserMesh, light };
  }

  public setPhotoeyeActive(active: boolean) {
    const mat = this.photoeyeLaserMesh.material as THREE.MeshBasicMaterial;
    if (active) {
      // Tripped state: Bright amber/red
      mat.color.setHex(0xf59e0b);
      this.photoeyeIndicatorLight.color.setHex(0xf59e0b);
      this.photoeyeIndicatorLight.intensity = 2.5;
    } else {
      // Idle state: Green
      mat.color.setHex(0x22c55e);
      this.photoeyeIndicatorLight.color.setHex(0x22c55e);
      this.photoeyeIndicatorLight.intensity = 1.0;
    }
  }

  public updateBeltAnimation(speed: number, delta: number) {
    if (speed > 0) {
      // Scroll texture to emulate moving conveyor belt
      this.mainBeltTexture.offset.x -= speed * delta * 0.35;

      // Rotate gravity rollers continuously at their own line speed (higher angular velocity)
      const spurAngularSpeed = speed * 6.5;
      for (const roller of this.rollerMeshes) {
        roller.rotation.x += spurAngularSpeed * delta;
      }
    }
  }

  public dispose() {
    this.mainBeltTexture.dispose();
    this.rollerTexture.dispose();
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
