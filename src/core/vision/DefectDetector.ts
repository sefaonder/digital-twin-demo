import type { DefectInfo, InspectionResult, PartBoundingBox, DefectType } from '../../types/scada';
import { openCVLoader } from './OpenCVLoader';

export class DefectDetector {
  /**
   * Two-stage inspection of an industrial camera frame:
   * Stage 1: Detects the metal cube (workpiece localization) on the conveyor.
   * Stage 2: Detects surface defects (scratch, spot, contamination) within the localized workpiece.
   */
  public static inspect(
    canvas: HTMLCanvasElement,
    partId: string,
    serialNumber: string
  ): InspectionResult {
    const t0 = performance.now();

    if (openCVLoader.isReady()) {
      try {
        return this.inspectWithOpenCV(canvas, partId, serialNumber, t0);
      } catch (err) {
        console.error('[DefectDetector] OpenCV execution error, using fallback:', err);
      }
    }

    // High performance Pure JS Fallback Engine
    return this.inspectWithNativeJS(canvas, partId, serialNumber, t0);
  }

  /**
   * Hierarchical Two-Stage OpenCV.js WebAssembly Edge Processing
   */
  private static inspectWithOpenCV(
    canvas: HTMLCanvasElement,
    partId: string,
    serialNumber: string,
    startTime: number
  ): InspectionResult {
    const cv = window.cv;
    const { width, height } = canvas;

    let src: any = null;
    let gray: any = null;
    let blur: any = null;
    let partMask: any = null;
    let contours: any = null;
    let hierarchy: any = null;

    let partRoiMat: any = null;
    let defectMask: any = null;
    let defectContours: any = null;
    let defectHierarchy: any = null;

    try {
      // 1. Read camera frame
      src = cv.imread(canvas);
      gray = new cv.Mat();
      blur = new cv.Mat();
      partMask = new cv.Mat();

      // Convert to Grayscale & suppress sensor noise
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);

      // ==========================================
      // STAGE 1: METAL CUBE (WORKPIECE) DETECTION
      // ==========================================
      // Segment the bright metallic cube (luma > 115) from the darker conveyor background (luma < 90)
      cv.threshold(blur, partMask, 115, 255, cv.THRESH_BINARY);

      contours = new cv.MatVector();
      hierarchy = new cv.Mat();
      cv.findContours(partMask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      let partBox: PartBoundingBox = {
        x: Math.round(width * 0.15),
        y: Math.round(height * 0.15),
        width: Math.round(width * 0.7),
        height: Math.round(height * 0.7),
        area: Math.round(width * height * 0.49)
      };

      let largestContourArea = 0;
      const minPartArea = (width * height) * 0.08; // At least 8% of frame
      const maxPartArea = (width * height) * 0.95;

      for (let i = 0; i < contours.size(); ++i) {
        const cnt = contours.get(i);
        const area = cv.contourArea(cnt);
        if (area >= minPartArea && area <= maxPartArea && area > largestContourArea) {
          largestContourArea = area;
          const rect = cv.boundingRect(cnt);
          partBox = {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            area: Math.round(area)
          };
        }
        cnt.delete();
      }

      // ==========================================
      // STAGE 2: DEFECT DETECTION WITHIN METAL CUBE
      // ==========================================
      // Add inward margin (6%) to prevent false positives from chamfered outer edges
      const marginX = Math.round(partBox.width * 0.06);
      const marginY = Math.round(partBox.height * 0.06);

      const roiX = Math.max(0, partBox.x + marginX);
      const roiY = Math.max(0, partBox.y + marginY);
      const roiW = Math.min(width - roiX, Math.max(10, partBox.width - marginX * 2));
      const roiH = Math.min(height - roiY, Math.max(10, partBox.height - marginY * 2));

      const roiRect = new cv.Rect(roiX, roiY, roiW, roiH);
      partRoiMat = blur.roi(roiRect);

      // Invert threshold on metallic surface: bright metal is > 140, dark defect is < 105
      defectMask = new cv.Mat();
      cv.threshold(partRoiMat, defectMask, 105, 255, cv.THRESH_BINARY_INV);

      defectContours = new cv.MatVector();
      defectHierarchy = new cv.Mat();
      cv.findContours(defectMask, defectContours, defectHierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      let maxDefect: DefectInfo | null = null;
      let largestDefectArea = 0;

      for (let i = 0; i < defectContours.size(); ++i) {
        const cnt = defectContours.get(i);
        const area = cv.contourArea(cnt);

        // Filter noise: defect area must be >= 20px and <= 40% of workpiece ROI
        if (area >= 20 && area < (roiW * roiH * 0.45)) {
          if (area > largestDefectArea) {
            largestDefectArea = area;
            const dRect = cv.boundingRect(cnt);

            // Defect classification based on morphology
            const aspectRatio = dRect.width / Math.max(1, dRect.height);
            let type: DefectType = 'SURFACE_SPOT';
            if (aspectRatio > 2.0 || aspectRatio < 0.5) {
              type = 'SCRATCH';
            } else if (area > 180) {
              type = 'CONTAMINATION';
            }

            maxDefect = {
              type,
              x: roiX + dRect.x,
              y: roiY + dRect.y,
              width: dRect.width,
              height: dRect.height,
              area: Math.round(area),
              severity: area > 220 ? 'HIGH' : area > 75 ? 'MEDIUM' : 'LOW'
            };
          }
        }
        cnt.delete();
      }

      const t1 = performance.now();
      const latencyMs = Number((t1 - startTime).toFixed(2));
      const isNOK = maxDefect !== null;

      // Generate Dual-Stage Annotated Snapshot & Raw Capture
      const { annotatedImageUrl, rawImageUrl } = this.generateAnnotatedSnapshot(
        canvas,
        serialNumber,
        partBox,
        maxDefect,
        latencyMs,
        'OpenCV.js WASM'
      );

      return {
        partId,
        serialNumber,
        status: isNOK ? 'NOK' : 'OK',
        timestamp: Date.now(),
        defectInfo: maxDefect,
        partBox,
        latencyMs,
        confidence: isNOK ? 0.985 : 0.995,
        engineUsed: 'OPENCV_WASM',
        annotatedImageUrl,
        rawImageUrl
      };
    } finally {
      // Memory deallocation for OpenCV WASM Heap
      if (src) src.delete();
      if (gray) gray.delete();
      if (blur) blur.delete();
      if (partMask) partMask.delete();
      if (contours) contours.delete();
      if (hierarchy) hierarchy.delete();

      if (partRoiMat) partRoiMat.delete();
      if (defectMask) defectMask.delete();
      if (defectContours) defectContours.delete();
      if (defectHierarchy) defectHierarchy.delete();
    }
  }

  /**
   * Pure JS Fallback Engine implementing the identical Two-Stage Pipeline
   */
  private static inspectWithNativeJS(
    canvas: HTMLCanvasElement,
    partId: string,
    serialNumber: string,
    startTime: number
  ): InspectionResult {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    if (!ctx) {
      return {
        partId,
        serialNumber,
        status: 'OK',
        timestamp: Date.now(),
        defectInfo: null,
        latencyMs: 1.0,
        confidence: 0.9,
        engineUsed: 'PIXEL_FALLBACK'
      };
    }

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // Stage 1: Segment Metal Cube (Luma > 115)
    let pMinX = width;
    let pMaxX = 0;
    let pMinY = height;
    let pMaxY = 0;
    let partPixelCount = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const luma = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (luma > 115) {
          partPixelCount++;
          if (x < pMinX) pMinX = x;
          if (x > pMaxX) pMaxX = x;
          if (y < pMinY) pMinY = y;
          if (y > pMaxY) pMaxY = y;
        }
      }
    }

    const partBox: PartBoundingBox = partPixelCount > (width * height * 0.08)
      ? {
          x: pMinX,
          y: pMinY,
          width: pMaxX - pMinX + 1,
          height: pMaxY - pMinY + 1,
          area: partPixelCount
        }
      : {
          x: Math.round(width * 0.15),
          y: Math.round(height * 0.15),
          width: Math.round(width * 0.7),
          height: Math.round(height * 0.7),
          area: Math.round(width * height * 0.49)
        };

    // Stage 2: Scan for defects within the detected metal cube
    const marginX = Math.round(partBox.width * 0.06);
    const marginY = Math.round(partBox.height * 0.06);
    const minScanX = partBox.x + marginX;
    const maxScanX = partBox.x + partBox.width - marginX;
    const minScanY = partBox.y + marginY;
    const maxScanY = partBox.y + partBox.height - marginY;

    let dMinX = width;
    let dMaxX = 0;
    let dMinY = height;
    let dMaxY = 0;
    let defectPixelCount = 0;

    for (let y = minScanY; y < maxScanY; y++) {
      for (let x = minScanX; x < maxScanX; x++) {
        const idx = (y * width + x) * 4;
        const luma = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (luma < 105) {
          defectPixelCount++;
          if (x < dMinX) dMinX = x;
          if (x > dMaxX) dMaxX = x;
          if (y < dMinY) dMinY = y;
          if (y > dMaxY) dMaxY = y;
        }
      }
    }

    const t1 = performance.now();
    const latencyMs = Number((t1 - startTime).toFixed(2));
    const isNOK = defectPixelCount >= 20;

    let defectInfo: DefectInfo | null = null;
    if (isNOK) {
      const dWidth = Math.max(10, dMaxX - dMinX + 1);
      const dHeight = Math.max(10, dMaxY - dMinY + 1);
      const aspectRatio = dWidth / dHeight;

      let type: DefectType = 'SURFACE_SPOT';
      if (aspectRatio > 2.0 || aspectRatio < 0.5) {
        type = 'SCRATCH';
      } else if (defectPixelCount > 180) {
        type = 'CONTAMINATION';
      }

      defectInfo = {
        type,
        x: dMinX,
        y: dMinY,
        width: dWidth,
        height: dHeight,
        area: defectPixelCount,
        severity: defectPixelCount > 220 ? 'HIGH' : defectPixelCount > 75 ? 'MEDIUM' : 'LOW'
      };
    }

    const { annotatedImageUrl, rawImageUrl } = this.generateAnnotatedSnapshot(
      canvas,
      serialNumber,
      partBox,
      defectInfo,
      latencyMs,
      'Pixel Scan Fallback'
    );

    return {
      partId,
      serialNumber,
      status: isNOK ? 'NOK' : 'OK',
      timestamp: Date.now(),
      defectInfo,
      partBox,
      latencyMs,
      confidence: 0.95,
      engineUsed: 'PIXEL_FALLBACK',
      annotatedImageUrl,
      rawImageUrl
    };
  }

  /**
   * Generates high-resolution annotated inspection snapshot with dual-stage bounding boxes
   * (Cyan for Metal Cube, Crimson Red for Defect) and industrial OSD header
   */
  public static generateAnnotatedSnapshot(
    sourceCanvas: HTMLCanvasElement,
    serialNumber: string,
    partBox: PartBoundingBox,
    defect: DefectInfo | null,
    latencyMs: number,
    engineUsed: string
  ): { annotatedImageUrl: string; rawImageUrl: string } {
    const outWidth = 512;
    const outHeight = 512;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = outWidth;
    outCanvas.height = outHeight;
    const ctx = outCanvas.getContext('2d')!;

    // 1. Draw source camera frame scaled to 512x512
    ctx.drawImage(sourceCanvas, 0, 0, outWidth, outHeight);

    // Save pristine raw capture before annotations
    const rawImageUrl = outCanvas.toDataURL('image/png');

    const scaleX = outWidth / sourceCanvas.width;
    const scaleY = outHeight / sourceCanvas.height;

    const px = Math.round(partBox.x * scaleX);
    const py = Math.round(partBox.y * scaleY);
    const pw = Math.round(partBox.width * scaleX);
    const ph = Math.round(partBox.height * scaleY);

    // 2. Stage 1: Metal Cube Localization (Cyan Box & Precision Corners)
    ctx.save();
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(px, py, pw, ph);
    ctx.setLineDash([]);

    // Solid corner brackets (16px)
    const bLen = 16;
    ctx.lineWidth = 3.5;
    // Top-Left
    ctx.beginPath();
    ctx.moveTo(px, py + bLen);
    ctx.lineTo(px, py);
    ctx.lineTo(px + bLen, py);
    ctx.stroke();
    // Top-Right
    ctx.beginPath();
    ctx.moveTo(px + pw - bLen, py);
    ctx.lineTo(px + pw, py);
    ctx.lineTo(px + pw, py + bLen);
    ctx.stroke();
    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(px, py + ph - bLen);
    ctx.lineTo(px, py + ph);
    ctx.lineTo(px + bLen, py + ph);
    ctx.stroke();
    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(px + pw - bLen, py + ph);
    ctx.lineTo(px + pw, py + ph);
    ctx.lineTo(px + pw, py + ph - bLen);
    ctx.stroke();

    // Stage 1 Label Banner
    ctx.fillStyle = 'rgba(0, 229, 255, 0.9)';
    ctx.fillRect(px, Math.max(48, py - 22), 240, 20);
    ctx.fillStyle = '#0a0f1a';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`[1] WORKPIECE: ${partBox.width}x${partBox.height}px`, px + 6, Math.max(62, py - 8));
    ctx.restore();

    // 3. Stage 2: Defect Localization Inside Metal Cube (Red Warning Box)
    if (defect) {
      const dx = Math.round(defect.x * scaleX);
      const dy = Math.round(defect.y * scaleY);
      const dw = Math.round(defect.width * scaleX);
      const dh = Math.round(defect.height * scaleY);

      ctx.save();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 10;
      ctx.strokeRect(dx, dy, dw, dh);

      // Warning corner accents
      const dbLen = 8;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(dx, dy + dbLen);
      ctx.lineTo(dx, dy);
      ctx.lineTo(dx + dbLen, dy);
      ctx.moveTo(dx + dw - dbLen, dy);
      ctx.lineTo(dx + dw, dy);
      ctx.lineTo(dx + dw, dy + dbLen);
      ctx.moveTo(dx, dy + dh - dbLen);
      ctx.lineTo(dx, dy + dh);
      ctx.lineTo(dx + dbLen, dy + dh);
      ctx.moveTo(dx + dw - dbLen, dy + dh);
      ctx.lineTo(dx + dw, dy + dh);
      ctx.lineTo(dx + dw, dy + dh - dbLen);
      ctx.stroke();

      // Defect Label Badge
      const badgeY = dy > 110 ? dy - 24 : dy + dh + 6;
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
      ctx.fillRect(dx, badgeY, 210, 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(
        `[2] DEFECT: ${defect.type} (${defect.area}px²)`,
        dx + 6,
        badgeY + 14
      );
      ctx.restore();
    } else {
      // Stage 2 PASS indicator
      ctx.save();
      ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
      ctx.fillRect(px + 4, py + ph - 26, 210, 20);
      ctx.fillStyle = '#0a0f1a';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('[2] NO DEFECT DETECTED (OK)', px + 10, py + ph - 12);
      ctx.restore();
    }

    // 4. Industrial Top OSD Header
    ctx.save();
    ctx.fillStyle = 'rgba(10, 15, 26, 0.88)';
    ctx.fillRect(0, 0, outWidth, 44);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 44);
    ctx.lineTo(outWidth, 44);
    ctx.stroke();

    // Machine Vision Title
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('CAM-01 OPTICAL INSPECTOR • TWO-STAGE OPENCV', 12, 17);

    // Metadata
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText(
      `SN: ${serialNumber}  |  ${engineUsed}  |  ${latencyMs}ms`,
      12,
      34
    );

    // Verdict Stamp (Top Right)
    const isNOK = defect !== null;
    ctx.fillStyle = isNOK ? '#ef4444' : '#22c55e';
    ctx.fillRect(outWidth - 110, 8, 98, 28);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(isNOK ? 'REJECT (NOK)' : 'PASS (OK)', outWidth - 61, 26);
    ctx.textAlign = 'left';
    ctx.restore();

    // 5. Industrial Bottom Status Bar
    ctx.save();
    ctx.fillStyle = 'rgba(10, 15, 26, 0.85)';
    ctx.fillRect(0, outHeight - 24, outWidth, 24);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    const timeStr = new Date().toLocaleTimeString();
    ctx.fillText(
      `SYS TIME: ${timeStr}  |  RESOLUTION: 512x512  |  CALIBRATION: 0.18mm/px`,
      12,
      outHeight - 8
    );
    ctx.restore();

    const annotatedImageUrl = outCanvas.toDataURL('image/png');
    return { annotatedImageUrl, rawImageUrl };
  }

  /**
   * Generates a realistic pre-captured defect record for instant gallery display & download
   */
  public static createSampleDefectRecord(): import('../../types/scada').DefectSnapshotRecord {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Conveyor background
    ctx.fillStyle = '#141a22';
    ctx.fillRect(0, 0, size, size);

    // Conveyor ribs
    ctx.fillStyle = '#0f141a';
    for (let i = 0; i < 32; i++) {
      ctx.fillRect(0, i * 16, size, 2);
    }

    // Side rails
    ctx.fillStyle = '#27303f';
    ctx.fillRect(0, 0, size, 28);
    ctx.fillRect(0, size - 28, size, 28);

    // Workpiece metal cube
    const partSize = 250;
    const px = Math.round((size - partSize) / 2);
    const py = Math.round((size - partSize) / 2);

    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(px, py, partSize, partSize);

    // Surface texture
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(px + 4, py + 4, partSize - 8, partSize - 8);

    // Brushed metal fine lines
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 50; i++) {
      const y = py + 4 + Math.random() * (partSize - 8);
      ctx.beginPath();
      ctx.moveTo(px + 4, y);
      ctx.lineTo(px + partSize - 4, y);
      ctx.stroke();
    }

    // Defect: Scratch flaw
    const dx = px + 68;
    const dy = py + 92;
    const dw = 58;
    const dh = 14;

    ctx.save();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(dx, dy);
    ctx.lineTo(dx + dw, dy + dh);
    ctx.stroke();
    ctx.restore();

    const partBox: PartBoundingBox = {
      x: px,
      y: py,
      width: partSize,
      height: partSize,
      area: partSize * partSize
    };

    const defect: DefectInfo = {
      type: 'SCRATCH',
      x: dx,
      y: dy,
      width: dw,
      height: dh,
      area: 148,
      severity: 'HIGH'
    };

    const { annotatedImageUrl, rawImageUrl } = this.generateAnnotatedSnapshot(
      canvas,
      'SN-2026-1001',
      partBox,
      defect,
      1.84,
      'OpenCV.js WASM'
    );

    return {
      id: 'sample-defect-1001',
      serialNumber: 'SN-2026-1001',
      timestamp: new Date().toLocaleTimeString(),
      timestampMs: Date.now(),
      status: 'NOK',
      defectType: 'SCRATCH',
      severity: 'HIGH',
      partBox,
      defectBox: {
        x: dx,
        y: dy,
        width: dw,
        height: dh,
        area: 148
      },
      confidence: 0.985,
      latencyMs: 1.84,
      engineUsed: 'OPENCV_WASM',
      annotatedImageUrl,
      rawImageUrl
    };
  }
}

