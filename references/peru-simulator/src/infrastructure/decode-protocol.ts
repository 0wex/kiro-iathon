export type ElevationFormat = 'geotiff' | 'terrarium';

export interface DecodeRequest {
  id: number;
  format: ElevationFormat;
  buffer: ArrayBuffer;
}

/** Decoder output: row-major heights in meters, row 0 is the northern edge. */
export interface FloatHeightTile {
  heights: Float32Array;
  width: number;
  height: number;
  min: number;
  max: number;
}

/**
 * Height tile as stored and uploaded: half-float bits of `height - offset`
 * (see `encodeHalfHeights`), half the memory of Float32.
 */
export interface DecodedHeightTile {
  /** Row-major half-float bits, row 0 is the northern edge. */
  heights: Uint16Array;
  /** Meters added back to every decoded value (the tile minimum). */
  offset: number;
  width: number;
  height: number;
  min: number;
  max: number;
}

export type DecodeResponse =
  | ({ id: number; ok: true } & DecodedHeightTile)
  | { id: number; ok: false; error: string };
