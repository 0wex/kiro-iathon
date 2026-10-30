import { Box3, Frustum, Matrix4, Vector3, type Camera } from 'three';
import type { FrustumLike, Vec3 } from '../domain/types';

/** Adapts a Three.js camera frustum to the domain FrustumLike port. */
export class ThreeFrustum implements FrustumLike {
  private readonly frustum = new Frustum();
  private readonly matrix = new Matrix4();
  private readonly box = new Box3(new Vector3(), new Vector3());

  update(camera: Camera): void {
    this.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.matrix);
  }

  intersectsBox(min: Vec3, max: Vec3): boolean {
    this.box.min.set(min.x, min.y, min.z);
    this.box.max.set(max.x, max.y, max.z);
    return this.frustum.intersectsBox(this.box);
  }
}
