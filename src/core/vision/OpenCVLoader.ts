declare global {
  interface Window {
    cv: any;
    Module?: any;
  }
}

export type OpenCVStatus = 'UNLOADED' | 'LOADING' | 'READY' | 'FAILED';

class OpenCVLoaderService {
  private status: OpenCVStatus = 'UNLOADED';
  private listeners: ((status: OpenCVStatus) => void)[] = [];
  private loadPromise: Promise<boolean> | null = null;

  public getStatus(): OpenCVStatus {
    return this.status;
  }

  public isReady(): boolean {
    return this.status === 'READY' && typeof window.cv !== 'undefined' && typeof window.cv.Mat !== 'undefined';
  }

  public subscribe(cb: (status: OpenCVStatus) => void): () => void {
    this.listeners.push(cb);
    cb(this.status);
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private setStatus(status: OpenCVStatus) {
    this.status = status;
    this.listeners.forEach(cb => cb(status));
  }

  public async load(): Promise<boolean> {
    if (this.isReady()) {
      return true;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.setStatus('LOADING');

    this.loadPromise = new Promise((resolve) => {
      // Check if already in window
      if (typeof window.cv !== 'undefined' && typeof window.cv.Mat !== 'undefined') {
        this.setStatus('READY');
        resolve(true);
        return;
      }

      // Configure Module callback for OpenCV.js WASM
      window.Module = window.Module || {};
      window.Module.onRuntimeInitialized = () => {
        console.log('[OpenCV.js] WASM Runtime initialized successfully.');
        this.setStatus('READY');
        resolve(true);
      };

      // Create script tag
      const existingScript = document.getElementById('opencv-wasm-script');
      if (existingScript) {
        // Wait timeout if already attached
        const checkInterval = setInterval(() => {
          if (this.isReady()) {
            clearInterval(checkInterval);
            this.setStatus('READY');
            resolve(true);
          }
        }, 150);

        setTimeout(() => {
          clearInterval(checkInterval);
          if (!this.isReady()) {
            console.warn('[OpenCV.js] Loading timed out, falling back to pure JS engine.');
            this.setStatus('FAILED');
            resolve(false);
          }
        }, 8000);
        return;
      }

      const script = document.createElement('script');
      script.id = 'opencv-wasm-script';
      script.async = true;
      script.src = 'https://docs.opencv.org/4.x/opencv.js';

      script.onload = () => {
        // Some builds initialize immediately, others need onRuntimeInitialized
        if (typeof window.cv !== 'undefined' && typeof window.cv.Mat !== 'undefined') {
          this.setStatus('READY');
          resolve(true);
        }
      };

      script.onerror = () => {
        console.warn('[OpenCV.js] Failed to load from CDN. Native JS Vision Engine will be used.');
        this.setStatus('FAILED');
        resolve(false);
      };

      document.body.appendChild(script);

      // Timeout fallback after 6 seconds so UI doesn't hang
      setTimeout(() => {
        if (!this.isReady()) {
          console.warn('[OpenCV.js] Network timeout. Falling back to native JS vision engine.');
          this.setStatus('FAILED');
          resolve(false);
        }
      }, 6000);
    });

    return this.loadPromise;
  }
}

export const openCVLoader = new OpenCVLoaderService();
