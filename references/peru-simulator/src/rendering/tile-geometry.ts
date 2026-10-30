import { BufferAttribute, BufferGeometry } from 'three';

/**
 * Unit-square grid shared by every tile. `position.xz` holds the tile UV
 * (v = 0 at the northern edge); `aSkirt` = 1 marks the skirt ring that the
 * vertex shader pushes downward to hide cracks between LOD levels.
 */
export function createTileGeometry(segments: number): BufferGeometry {
  const n = segments + 1;
  const gridCount = n * n;
  const skirtCount = segments * 4;
  const positions = new Float32Array((gridCount + skirtCount) * 3);
  const skirt = new Float32Array(gridCount + skirtCount);

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = (j * n + i) * 3;
      positions[k] = i / segments;
      positions[k + 2] = j / segments;
    }
  }

  // Border vertex indices in a closed loop (N edge, E edge, S edge, W edge).
  const border: number[] = [];
  for (let i = 0; i < segments; i++) border.push(i);
  for (let j = 0; j < segments; j++) border.push(j * n + segments);
  for (let i = segments; i > 0; i--) border.push(segments * n + i);
  for (let j = segments; j > 0; j--) border.push(j * n);

  border.forEach((gridIndex, b) => {
    const k = (gridCount + b) * 3;
    positions[k] = positions[gridIndex * 3]!;
    positions[k + 2] = positions[gridIndex * 3 + 2]!;
    skirt[gridCount + b] = 1;
  });

  const indices: number[] = [];
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * n + i;
      const b = a + 1;
      const c = a + n;
      const d = c + 1;
      // Counter-clockwise when viewed from above (+y), with v growing toward +z.
      indices.push(a, c, b, b, c, d);
    }
  }
  for (let b = 0; b < border.length; b++) {
    const top0 = border[b]!;
    const top1 = border[(b + 1) % border.length]!;
    const bottom0 = gridCount + b;
    const bottom1 = gridCount + ((b + 1) % border.length);
    indices.push(top0, top1, bottom0, top1, bottom1, bottom0);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aSkirt', new BufferAttribute(skirt, 1));
  geometry.setIndex(indices);
  return geometry;
}
