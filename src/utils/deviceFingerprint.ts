// src/utils/deviceFingerprint.ts
/**
 * Generador Determinista de Huella Digital de Hardware y Navegador (Device Fingerprint)
 * Estandar Zero Trust para Boveda de Dispositivos (Device Vault) - InAndes ERP
 */

export interface DeviceInfo {
  fingerprint: string;
  deviceName: string;
  userAgent: string;
  screenResolution: string;
}

function computeFnv1aHex(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  // Tomar 6 caracteres hexadecimales positivos
  const positive = (hash >>> 0).toString(16).toUpperCase();
  return (positive + '000000').slice(0, 6);
}

function detectOS(ua: string): { code: string; label: string } {
  if (/windows/i.test(ua)) return { code: 'WIN', label: 'Windows PC' };
  if (/macintosh|mac os x/i.test(ua)) return { code: 'MAC', label: 'macOS' };
  if (/iphone|ipad|ipod/i.test(ua)) return { code: 'IOS', label: 'Apple iOS' };
  if (/android/i.test(ua)) return { code: 'AND', label: 'Android' };
  if (/linux/i.test(ua)) return { code: 'LNX', label: 'Linux Workstation' };
  return { code: 'OTH', label: 'Dispositivo' };
}

function detectBrowser(ua: string): string {
  if (/edg/i.test(ua)) return 'Edge';
  if (/chrome|crios/i.test(ua) && !/edg/i.test(ua)) return 'Chrome';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Safari';
  return 'Navegador Web';
}

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'NO_CTX';
    ctx.textBaseline = 'top';
    ctx.font = "14px 'Arial', sans-serif";
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('InAndes.ERP.Security.2026', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('InAndes.ERP.Security.2026', 4, 17);
    return canvas.toDataURL();
  } catch (_e) {
    return 'CANVAS_ERR';
  }
}

export function getDeviceFingerprint(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      fingerprint: 'DEV-INANDES-SRV-000000',
      deviceName: 'Servidor Backend',
      userAgent: 'Node/Server',
      screenResolution: 'N/A'
    };
  }

  const ua = window.navigator?.userAgent || 'Unknown-UserAgent';
  const os = detectOS(ua);
  const browser = detectBrowser(ua);
  const screenRes = `${window.screen?.width || 0}x${window.screen?.height || 0}`;
  const cores = window.navigator?.hardwareConcurrency || 4;
  const lang = window.navigator?.language || 'es';

  // 1. Revisar si ya existe una huella persistida en LocalStorage
  const cachedFp = localStorage.getItem('inandes_device_fingerprint');
  if (cachedFp && cachedFp.startsWith('DEV-INANDES-')) {
    return {
      fingerprint: cachedFp,
      deviceName: `${os.label} (${browser})`,
      userAgent: ua,
      screenResolution: screenRes
    };
  }

  // 2. Generar huella criptografica estable
  const canvasData = getCanvasFingerprint();
  const seedString = `${ua}___${lang}___${screenRes}___${cores}___${canvasData}`;
  const hexHash = computeFnv1aHex(seedString);
  const generatedFp = `DEV-INANDES-${os.code}-${hexHash}`;

  try {
    localStorage.setItem('inandes_device_fingerprint', generatedFp);
  } catch (_e) {
    // Si almacenamiento local esta bloqueado, continuar en memoria
  }

  return {
    fingerprint: generatedFp,
    deviceName: `${os.label} (${browser})`,
    userAgent: ua,
    screenResolution: screenRes
  };
}
