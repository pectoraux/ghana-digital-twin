// Ghana Digital Twin — client-side photo helper
// Phase 3.13: Proof-of-work capture for community events
//   - Reads EXIF GPS coordinates from a JPEG (no external deps)
//   - Falls back to browser Geolocation API when EXIF GPS is missing
//   - Resizes / compresses an image via canvas to keep payloads < 2MB
//
// All public functions are browser-only (no Node APIs).

export interface PhotoMeta {
  dataUrl: string;          // resized/compressed JPEG data URL
  thumbnailUrl: string;     // small preview thumbnail data URL
  capturedAt?: string;     // ISO timestamp (EXIF DateTimeOriginal or Date.now())
  gpsLat?: number;
  gpsLng?: number;
  accuracyM?: number;
  fileSizeKb: number;      // size of the dataUrl payload (approx)
  width: number;
  height: number;
  source: "exif" | "geolocation" | "none";
}

const MAX_DIM = 1280;       // max longest side in px
const THUMB_DIM = 160;
const JPEG_QUALITY = 0.72;  // ~70% quality — keeps dataUrl < 2MB for typical phone photos

// ---------------------------------------------------------------------------
// 1. EXIF parsing — minimal, browser-only. Returns GPS + capture time.
// ---------------------------------------------------------------------------

interface ExifData {
  gpsLat?: number;
  gpsLng?: number;
  capturedAt?: string;
}

export async function readExif(file: File): Promise<ExifData> {
  try {
    if (!file.type.startsWith("image/jpeg")) return {};
    const buf = await file.arrayBuffer();
    const view = new DataView(buf);
    const bytes = new Uint8Array(buf);

    // SOI marker check
    if (view.getUint16(0) !== 0xffd8) return {};

    let offset = 2;
    let exifOffset = -1;

    // Walk APP segments looking for APP1 with "Exif\0\0"
    while (offset < bytes.length) {
      if (view.getUint16(offset) !== 0xffe1) break; // not APP1
      const segLen = view.getUint16(offset + 2);
      const magic = bytes.slice(offset + 4, offset + 10);
      // "Exif\0\0"
      if (
        magic[0] === 0x45 && // E
        magic[1] === 0x78 && // x
        magic[2] === 0x69 && // i
        magic[3] === 0x66 && // f
        magic[4] === 0x00 &&
        magic[5] === 0x00
      ) {
        exifOffset = offset + 10;
        break;
      }
      offset += 2 + segLen;
    }
    if (exifOffset < 0) return {};

    // TIFF header at exifOffset
    const tiff = exifOffset;
    const littleEndian = view.getUint16(tiff) === 0x4949; // "II"
    const read16 = (o: number) => view.getUint16(o, littleEndian);
    const read32 = (o: number) => view.getUint32(o, littleEndian);

    const ifd0Offset = tiff + read32(tiff + 4);
    const entries0 = read16(ifd0Offset);

    let gpsIfdOffset = 0;
    let exifIfdOffset = 0;

    // Walk IFD0 entries
    for (let i = 0; i < entries0; i++) {
      const entryOff = ifd0Offset + 2 + i * 12;
      const tag = read16(entryOff);
      if (tag === 0x8769) exifIfdOffset = tiff + read32(entryOff + 8); // ExifIFD pointer
      if (tag === 0x8825) gpsIfdOffset = tiff + read32(entryOff + 8); // GPS IFD pointer
    }

    const out: ExifData = {};

    // ---- GPS IFD ----
    if (gpsIfdOffset) {
      const count = read16(gpsIfdOffset);
      let latRef = "N";
      let lngRef = "E";
      let latRational: [number, number, number] | null = null;
      let lngRational: [number, number, number] | null = null;

      for (let i = 0; i < count; i++) {
        const e = gpsIfdOffset + 2 + i * 12;
        const tag = read16(e);
        const type = read16(e + 2);
        const valOff = e + 8;
        // type 2 = ASCII, type 5 = RATIONAL (8 bytes per: num/den)
        if (tag === 0x0001 && type === 2) {
          latRef = String.fromCharCode(bytes[valOff]);
        } else if (tag === 0x0003 && type === 2) {
          lngRef = String.fromCharCode(bytes[valOff]);
        } else if (tag === 0x0002 && type === 5) {
          const off = read32(valOff) + tiff;
          latRational = [rational(view, off, littleEndian), rational(view, off + 8, littleEndian), rational(view, off + 16, littleEndian)];
        } else if (tag === 0x0004 && type === 5) {
          const off = read32(valOff) + tiff;
          lngRational = [rational(view, off, littleEndian), rational(view, off + 8, littleEndian), rational(view, off + 16, littleEndian)];
        }
      }

      if (latRational && lngRational) {
        const lat = dmsToDecimal(latRational[0], latRational[1], latRational[2], latRef);
        const lng = dmsToDecimal(lngRational[0], lngRational[1], lngRational[2], lngRef);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          out.gpsLat = lat;
          out.gpsLng = lng;
        }
      }
    }

    // ---- ExifIFD: DateTimeOriginal (0x9003) ----
    if (exifIfdOffset) {
      const count = read16(exifIfdOffset);
      for (let i = 0; i < count; i++) {
        const e = exifIfdOffset + 2 + i * 12;
        const tag = read16(e);
        const type = read16(e + 2);
        if ((tag === 0x9003 || tag === 0x0132) && type === 2) {
          // ASCII — could be inline (count <= 4) or offset
          const cnt = read32(e + 4);
          const valOff = cnt > 4 ? read32(e + 8) + tiff : e + 8;
          let str = "";
          for (let k = 0; k < cnt - 1; k++) {
            const c = bytes[valOff + k];
            if (c === 0) break;
            str += String.fromCharCode(c);
          }
          // Format: "YYYY:MM:DD HH:MM:SS" → ISO
          const m = str.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
          if (m) {
            out.capturedAt = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
          }
        }
      }
    }

    return out;
  } catch {
    return {};
  }
}

function rational(view: DataView, offset: number, le: boolean): number {
  const num = view.getUint32(offset, le);
  const den = view.getUint32(offset + 4, le);
  if (den === 0) return 0;
  return num / den;
}

function dmsToDecimal(deg: number, min: number, sec: number, ref: string): number {
  let dec = Math.abs(deg) + min / 60 + sec / 3600;
  if (ref === "S" || ref === "W") dec = -dec;
  return dec;
}

// ---------------------------------------------------------------------------
// 2. Geolocation API fallback (browser only)
// ---------------------------------------------------------------------------

export function getBrowserLocation(timeoutMs = 5000): Promise<{ lat: number; lng: number; accuracyM?: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy }),
      () => resolve(null),
      { timeout: timeoutMs, enableHighAccuracy: true, maximumAge: 30000 }
    );
  });
}

// ---------------------------------------------------------------------------
// 3. Resize + compress image via canvas → returns data URL + thumbnail
// ---------------------------------------------------------------------------

export async function processImage(file: File): Promise<{ dataUrl: string; thumbnailUrl: string; width: number; height: number; fileSizeKb: number }> {
  const bitmap = await loadBitmap(file);
  const { canvas, width, height } = drawScaled(bitmap, MAX_DIM);
  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);

  const thumb = drawScaled(bitmap, THUMB_DIM);
  const thumbnailUrl = thumb.canvas.toDataURL("image/jpeg", 0.6);

  // Release bitmap memory if it's a closeable ImageBitmap
  if ("close" in bitmap && typeof (bitmap as ImageBitmap).close === "function") {
    (bitmap as ImageBitmap).close();
  }

  // Approximate byte size: 4/3 of base64 chars minus header overhead
  const b64 = dataUrl.split(",")[1] ?? "";
  const fileSizeKb = Math.max(1, Math.round((b64.length * 3) / 4 / 1024));

  return { dataUrl, thumbnailUrl, width, height, fileSizeKb };
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to HTMLImageElement
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

function drawScaled(source: ImageBitmap | HTMLImageElement, maxDim: number): { canvas: HTMLCanvasElement; width: number; height: number } {
  let sw: number;
  let sh: number;
  if (source instanceof HTMLImageElement) {
    sw = source.naturalWidth || source.width;
    sh = source.naturalHeight || source.height;
  } else {
    // ImageBitmap
    sw = source.width;
    sh = source.height;
  }
  const longest = Math.max(sw, sh);
  const scale = longest > maxDim ? maxDim / longest : 1;
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);
  return { canvas, width, height };
}

// ---------------------------------------------------------------------------
// 4. End-to-end: take a File, return a fully-populated PhotoMeta
// ---------------------------------------------------------------------------

export async function preparePhoto(file: File, fallbackLocation?: { lat: number; lng: number; accuracyM?: number } | null): Promise<PhotoMeta> {
  const [{ dataUrl, thumbnailUrl, width, height, fileSizeKb }, exif] = await Promise.all([
    processImage(file),
    readExif(file),
  ]);

  let gpsLat = exif.gpsLat;
  let gpsLng = exif.gpsLng;
  let accuracyM: number | undefined;
  let source: "exif" | "geolocation" | "none" = "none";

  if (typeof gpsLat === "number" && typeof gpsLng === "number") {
    source = "exif";
  } else if (fallbackLocation) {
    gpsLat = fallbackLocation.lat;
    gpsLng = fallbackLocation.lng;
    accuracyM = fallbackLocation.accuracyM;
    source = "geolocation";
  }

  return {
    dataUrl,
    thumbnailUrl,
    capturedAt: exif.capturedAt,
    gpsLat,
    gpsLng,
    accuracyM,
    fileSizeKb,
    width,
    height,
    source,
  };
}
