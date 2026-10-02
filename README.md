# Digital Twin Concept Demo

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.1-61dafb.svg)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r182-black.svg)](https://threejs.org/)
[![OpenCV.js](https://img.shields.io/badge/OpenCV.js-4.x_WASM-5C8DBC.svg)](https://docs.opencv.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF.svg)](https://vitejs.dev/)
[![Oxlint](https://img.shields.io/badge/Oxlint-0_Warnings-green.svg)](https://oxc.rs/)

> **Notice:** This application is a **Concept Demonstration** designed to establish the **initial foundational steps for an Industrial Digital Twin**. Its primary objective is to prototype, test, and validate core architectural concepts—including real-time 3D kinematic modeling, virtual machine vision sensor feeds, edge-level defect detection algorithms, and SCADA monitoring—before committing to physical assembly or full-scale cyber-physical integration.

---

## Purpose & Concept Objectives

The goal of this demo is to explore and prove the core tenets of modern manufacturing digital twins in an accessible web-native environment:

1. **Kinematic Modeling & Physics Twin:** Validating real-time conveyor physics, realistic workpiece lateral drift/orientation variations, mechanical diverter piston interactions, and gravity-assisted roller ejection.
2. **Virtual Optical Sensor Emulation:** Prototyping a telecentric industrial smart camera that captures virtual frames directly from the 3D scene with configurable electronic exposure, analog sensor gain, and quad-LED illumination.
3. **Hierarchical Computer Vision Pipeline:** Demonstrating edge-based automated quality assurance using **OpenCV.js (WebAssembly)**, isolating the workpiece first before detecting internal microscopic defects.
4. **Closed-Loop Supervisory Control (SCADA HMI):** Testing human-machine interface workflows, including real-time telemetry streaming, interactive camera parameter tuning, dynamic alarm logging, and instant defect capture retrieval.

---

## Key Capabilities

* **3D Digital Twin Simulation Engine:**
  * **Conveyor Kinematics:** Realistic belt velocity control, lateral drift, and angular yaw variation on metallic workpieces.
  * **Precision Diverter Piston:** Kinematically coupled pneumatic piston that mechanically pushes rejected workpieces onto an inclined gravity roller spur.
  * **Hollow Machine Chambers:** Infeed feeder, packaging outfeed tunnel, and scrap quarantine station with internal receiving ramps and zero geometry clipping.
  * **Industrial Smart Camera Gantry:** Keyence/Cognex-inspired CNC aluminum smart camera with C-mount telecentric lens, quad-LED spot illumination pods, and Rexroth aluminum gantry bridges.

* **Hierarchical Two-Stage Computer Vision Pipeline:**
  * **Stage 1 (Workpiece Localization):** Segments and isolates the bright metallic cube against the dark industrial conveyor surface, detecting the outer part boundaries (`[1] WORKPIECE`).
  * **Stage 2 (Defect Localization):** Evaluates the region of interest (ROI) inside the localized metal cube, detecting surface anomalies (`[2] DEFECT`) including **scratches**, **surface spots**, and **contamination blobs**.
  * **Hybrid Execution Engine:** Employs OpenCV.js compiled to WebAssembly with SIMD acceleration, complemented by an autonomous pure-TypeScript pixel scanning fallback for 100% operational uptime.

* **Last 3 Defect Captures Gallery & PNG Export:**
  * Captures high-resolution (512x512) dual-stage annotated inspection frames of the last 3 defective (NOK) items in real-time FIFO order.
  * **Direct PNG Download:** Users can download inspection images (`DEFECT_<Serial>_<Type>.png`) with high-contrast bounding boxes, coordinates, and OSD telemetry stamps.
  * **Interactive Inspection Modal:** Side-by-side or toggled view between **OpenCV Analyzed** and **Raw Sensor Frame** with dimensional metric breakdowns.

* **Production SCADA HMI Interface:**
  * **Dual Display Modes:** Toggle seamlessly between the interactive **3D Digital Twin View** and the dedicated **Standalone Vision Station**.
  * **Real-time Camera Telemetry:** Live OSD tracking FPS, exposure time ($\mu s$), analog gain, sensor temperature, and hardware photoeye triggers.
  * **Pixel Luminance Histogram:** Real-time 64-bin luminance spectrum visualization.
  * **Live Event & Alarm Journal:** Timestamped audit trail of passes, defects, and diverter actuations.

---

## Architectural Flow

```
                      +-----------------------------+
                      |       Production Line       |
                      |   (Kinematics & Workpieces) |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |   Optical Photoeye Trigger  |
                      |          (Zone X = 0)       |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |    Industrial Vision Sensor |
                      |    (Telecentric Virtual Cam)|
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |   Two-Stage DefectDetector  |
                      +--------------+--------------+
                       /                            \
                      /                              \
        [Stage 1: Workpiece]                [Stage 2: Defect ROI]
      - Grayscale & Gaussian Blur         - Inset Safety Margin
      - Luma Thresholding (>115)          - Inverse Thresholding (<105)
      - Outer Contour Box [Cyan]          - Flaw Classification [Red]
                      \                              /
                       \                            /
                      +--------------+--------------+
                      |      Inspection Verdict     |
                      +--------------+--------------+
                             /                \
                            /                  \
                     [PASS / OK]          [REJECT / NOK]
                          |                      |
                    Main Packaging       Piston Actuator Triggers
                    Outfeed Gateway      Defective Part Diverted to
                                         Gravity Roller Quarantine Bin
                                                 |
                                         Pushed to Defect Gallery
                                         (Downloadable 512x512 PNG)
```

---

## Technology Stack

| Technology | Purpose |
| :--- | :--- |
| **React 19** | Component hierarchy, reactive SCADA telemetry state management |
| **TypeScript 5.9** | Strict compile-time safety and type contracts across sim and vision systems |
| **Three.js (r182)** | WebGL 3D industrial simulation, custom materials, lighting, and camera pipelines |
| **OpenCV.js (WASM)** | Edge computer vision, contour analysis, morphology, and defect classification |
| **Tailwind CSS v4** | Industrial high-contrast engineering design system |
| **Vite 8** | High-performance bundling, development server, and optimized chunk distribution |
| **Oxlint** | High-speed static analysis guaranteeing zero linter warnings or errors |

---

## Getting Started

### Prerequisites

* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher

### Installation

1. Clone or open the repository workspace:
   ```bash
   cd test-2
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch the development server:
   ```bash
   npm run dev
   ```
   The application will be accessible at: `http://127.0.0.1:5173/`

### Production Build & Quality Verification

To compile the production distribution with strict type checking:

```bash
npm run build
```

To run static lint analysis:

```bash
npx oxlint
```

---

## Operating the Demo

1. **Viewing Modes:**
   * **3D Twin View:** Orbit around the entire manufacturing line using mouse click + drag (left button to orbit, wheel to zoom).
   * **Standalone Vision View:** Switch using the top bar tab or the expand button in the vision widget to enter full-screen camera inspection with the live 64-bin luminance histogram.

2. **Triggering Defects:**
   * Parts randomly spawn with a ~38% defect rate by default.
   * To immediately evaluate a defect, click **"Force NOK Part"** in the Control Panel. The next spawned workpiece will carry a surface defect.

3. **Inspecting & Downloading Defect Snapshots:**
   * When an NOK workpiece passes under the inspection station, it is flagged by the two-stage detector.
   * Its annotated snapshot immediately appears in **Slot #1** of the **Last 3 Defect Captures** gallery.
   * Click **"Download Image"** on any card to export a high-resolution PNG file (`DEFECT_<Serial>_<Type>.png`) directly to your machine.
   * Click on the card thumbnail to open the **Defect Inspection Report** modal for deep-dive coordinate analysis and raw/analyzed image comparison.

4. **Line Speed & Emergency Controls:**
   * Adjust line velocity in real-time from `0.5 m/s` to `5.0 m/s` via the slider.
   * Use the red **"E-STOP"** button to freeze kinematics immediately for maintenance simulation.
   * Select isometric, top-down optical, or diverter close-up camera presets via the view preset buttons.

---

## Next Steps & Roadmap: Extending the Digital Twin Concept

As an initial concept demonstrator, this application establishes the core foundations of kinematic modeling, optical sensor capture, edge computer vision, and SCADA oversight. The following architectural extensions represent the planned roadmap to scale this prototype into an enterprise-grade cyber-physical twin:

### 1. Multi-Camera Inspection Stations
* **Multi-Angle Synchronized Acquisition:** Deploy additional orthogonal and angled smart cameras (e.g., Cam-02 Side Profile Left, Cam-03 Side Profile Right, Cam-04 Bottom / Under-Belt Scanner) to achieve full 360° workpiece defect coverage.
* **Stereo Vision & 3D Point Cloud Scanning:** Utilize dual-camera epipolar geometry to generate real-time depth maps, enabling height profiling, surface flatness verification, and 3D volumetric tolerance checks.
* **Multi-Camera Command Center:** Upgrade the Standalone Vision Station into a unified Multi-Camera HMI with split-screen multi-feed monitoring, independent per-camera exposure/gain controls, and synchronized trigger timestamps.

### 2. Modular & Extendable Conveyor Belt Mechanisms
* **Procedural Modular Belt Segments:** Refactor the conveyor architecture into composable, chainable track modules (e.g., standardized 2-meter straight sections, 90° radial curved transitions, incline elevators, and transfer junctions).
* **Multi-Belt Differential Speed Zones:** Simulate factory line transitions where successive belt segments operate at varying speeds, accurately modeling workpiece accumulation zones, buffering lanes, and pacing bottlenecks.
* **Dynamic Route Branching & Transfers:** Introduce bidirectional divert flaps, push-pull cross-transfers, and robotic pick-and-place cells connecting parallel manufacturing lines.

### 3. Multi-Modal Defect Catching Mechanisms
* **Thermal Infrared (FLIR) Imaging Station:**
  * Simulate thermal signatures to detect internal structural voids, electrical short-circuits, uneven heat dissipation, and hot-spot stress concentrations before mechanical failure.
  * Render dynamic pseudocolor thermal heatmaps (Ironbow / Rainbow palettes) with localized temperature delta ($\Delta T$) threshold alarms.
* **Laser Displacement & Profile Triangulation:**
  * Implement laser line triangulation sensors to measure chamfer angles, weld seam volume, and sub-millimeter surface warpage.
* **Acoustic Resonance / Vibration Analysis:**
  * Emulate piezoelectric acoustic sensors along conveyor rails to detect internal micro-fissures and material density irregularities via spectral FFT frequency analysis.

### 4. Multi-Station Production Line Architecture
* **Sequential Manufacturing Stations:**
  * **Station 1 (Infeed & Dimensional Fixturing):** Validates raw stock dimensions, orientation, and surface readiness.
  * **Station 2 (Robotic Machining & Stamping):** Simulates surface etching, milling, or drilling with simulated tool wear.
  * **Station 3 (Optical & Thermal Quality Gate):** Multi-modal quality inspection combining computer vision and thermal QA.
  * **Station 4 (Quarantine / Laser Marking / Packaging):** Laser-marks verified QR serial codes on passed parts and diverts rejected units into categorized rework/scrap bins based on defect severity.
* **Distributed PLC & OPC-UA / MQTT Connectivity:**
  * Bridge the WebGL digital twin to real-world industrial controllers via standardized IoT protocols (OPC-UA, MQTT, Modbus TCP), enabling true two-way synchronization between physical shop-floor hardware and the virtual twin.

---

## License

This project is released under the **MIT License**.

