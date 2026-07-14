'use client';

/**
 * Thin client for the vendored LibRaw worker (M5 — RAW support).
 *
 * This is a faithful TS port of `libraw-wasm`'s default-export wrapper, changed
 * in exactly one way: the worker is spawned from the FIXED static path
 * `/libraw/worker.js` instead of `new Worker(new URL('./worker.js',
 * import.meta.url))`. That matters because the `new URL(..., import.meta.url)`
 * form makes Turbopack try to trace + bundle the worker and its 1.4MB wasm at
 * build time, which deadlocks `next build`. A plain string URL is treated as a
 * runtime asset (served from public/, see scripts/copy-libraw.mjs), so the
 * bundler never touches it. Types still come from the npm package via a
 * type-only import (fully erased at compile — no runtime bundling).
 *
 * The RPC protocol (postMessage {id, fn, args}; reply {id, out|error}) and the
 * serialized tail-queue are identical to the upstream package so behavior is
 * unchanged.
 */
import type {
  LibRawSettings,
  LibRawMetadata,
  RawImageData,
  RawSensorData,
  ThumbnailImageData,
} from 'libraw-wasm';

const WORKER_URL = '/libraw/worker.js';

const TRANSFERABLE = [
  ArrayBuffer,
  Uint8Array,
  Int8Array,
  Uint16Array,
  Int16Array,
  Uint32Array,
  Int32Array,
  Float32Array,
  Float64Array,
];

const THUMB_FORMATS = [
  'unknown',
  'jpeg',
  'bitmap',
  'bitmap16',
  'layer',
  'rollei',
  'h265',
];

interface Pending {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
}

export default class LibRaw {
  private worker: Worker;
  private pending = new Map<number, Pending>();
  private nextId = 0;
  private tail: Promise<unknown> = Promise.resolve();
  private disposed = false;

  constructor() {
    this.worker = new Worker(WORKER_URL, { type: 'module' });
    this.worker.onmessage = ({ data }: MessageEvent) => {
      const entry = this.pending.get(data?.id);
      if (!entry) return;
      this.pending.delete(data.id);
      if (data?.error) entry.reject(new Error(data.error));
      else entry.resolve(data?.out);
    };
  }

  dispose() {
    this.disposed = true;
    this.worker.terminate();
    for (const { reject } of this.pending.values()) reject(new Error('LibRaw disposed'));
    this.pending.clear();
  }

  private runFn(fn: string, ...args: unknown[]): Promise<unknown> {
    const run = () =>
      new Promise<unknown>((resolve, reject) => {
        if (this.disposed) {
          reject(new Error('LibRaw disposed'));
          return;
        }
        const id = this.nextId++;
        this.pending.set(id, { resolve, reject });
        const transfer = args
          .map((a) =>
            TRANSFERABLE.some((T) => a instanceof T)
              ? (a as ArrayBufferView).buffer ?? (a as ArrayBuffer)
              : undefined,
          )
          .filter((b): b is ArrayBuffer => Boolean(b));
        this.worker.postMessage({ id, fn, args }, transfer);
      });
    // Serialize calls through a tail promise, exactly like upstream.
    const p = this.tail.then(run, run);
    this.tail = p.then(
      () => {},
      () => {},
    );
    return p;
  }

  async open(data: Uint8Array, settings?: Partial<LibRawSettings>): Promise<void> {
    await this.runFn('open', data, settings);
  }

  async metadata(fullOutput?: boolean): Promise<LibRawMetadata | undefined> {
    const meta = (await this.runFn('metadata', !!fullOutput)) as
      | (Record<string, unknown> & { thumb_format?: number; desc?: string; timestamp?: number })
      | undefined;
    if (meta?.hasOwnProperty('thumb_format')) {
      (meta as Record<string, unknown>).thumb_format =
        THUMB_FORMATS[meta.thumb_format as number] || 'unknown';
    }
    if (meta?.hasOwnProperty('desc')) {
      (meta as Record<string, unknown>).desc = String(meta.desc).trim();
    }
    if (meta?.hasOwnProperty('timestamp')) {
      (meta as Record<string, unknown>).timestamp = new Date((meta.timestamp as number) * 1000);
    }
    return meta as LibRawMetadata | undefined;
  }

  async imageData(): Promise<RawImageData | undefined> {
    return (await this.runFn('imageData')) as RawImageData | undefined;
  }

  async rawImageData(): Promise<RawSensorData | undefined> {
    return (await this.runFn('rawImageData')) as RawSensorData | undefined;
  }

  async thumbnailData(): Promise<ThumbnailImageData | undefined> {
    return (await this.runFn('thumbnailData')) as ThumbnailImageData | undefined;
  }
}
