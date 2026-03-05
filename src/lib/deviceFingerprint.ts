// Device fingerprint collector - generates a unique hash from browser/device characteristics

async function getCanvasHash(): Promise<string> {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';
    canvas.width = 200;
    canvas.height = 50;
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('1001Jobs🔒', 2, 15);
    ctx.fillStyle = 'rgba(102,204,0,0.7)';
    ctx.fillText('fingerprint', 4, 17);
    return canvas.toDataURL().slice(-50);
  } catch {
    return 'canvas-error';
  }
}

function getWebGLRenderer(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'no-webgl';
    const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return 'no-debug-info';
    return (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown';
  } catch {
    return 'webgl-error';
  }
}

async function simpleHash(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface DeviceFingerprint {
  fingerprint_hash: string;
  user_agent: string;
  platform: string;
  language: string;
  timezone: string;
  screen_resolution: string;
  color_depth: number;
  touch_support: boolean;
  webgl_renderer: string;
  canvas_hash: string;
}

export async function collectFingerprint(): Promise<DeviceFingerprint> {
  const canvasHash = await getCanvasHash();
  const webglRenderer = getWebGLRenderer();
  const screenResolution = `${screen.width}x${screen.height}`;
  const colorDepth = screen.colorDepth;
  const touchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const platform = navigator.platform || 'unknown';
  const language = navigator.language || 'unknown';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
  const userAgent = navigator.userAgent;

  // Build composite string for hashing
  const composite = [
    userAgent, platform, language, timezone,
    screenResolution, colorDepth.toString(),
    touchSupport.toString(), webglRenderer, canvasHash,
  ].join('|');

  const hash = await simpleHash(composite);

  return {
    fingerprint_hash: hash,
    user_agent: userAgent,
    platform,
    language,
    timezone,
    screen_resolution: screenResolution,
    color_depth: colorDepth,
    touch_support: touchSupport,
    webgl_renderer: webglRenderer,
    canvas_hash: canvasHash,
  };
}

// Get approximate geolocation from IP (free API)
export async function getGeoFromIP(): Promise<{
  ip: string;
  city: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
} | null> {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      ip: data.ip || '',
      city: data.city || '',
      region: data.region || '',
      country: data.country_name || '',
      lat: data.latitude || 0,
      lon: data.longitude || 0,
    };
  } catch {
    return null;
  }
}
