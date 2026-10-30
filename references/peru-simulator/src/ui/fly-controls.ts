import { Euler, Vector3, type PerspectiveCamera } from 'three';

const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight']);

/**
 * Free-flight camera: WASD to move, Q/E to descend/ascend, Shift to boost,
 * drag to look around. Speed scales with height above ground.
 */
export class FlyControls {
  enabled = false;
  private readonly pressed = new Set<string>();
  private readonly euler = new Euler(0, 0, 0, 'YXZ');
  private dragging = false;
  private readonly forward = new Vector3();
  private readonly right = new Vector3();
  private readonly move = new Vector3();

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly element: HTMLElement,
  ) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    element.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointermove', this.onPointerMove);
  }

  /** Advances the camera; returns true when it moved. */
  update(deltaSeconds: number, heightAboveGround: number): boolean {
    if (!this.enabled) return false;
    this.camera.getWorldDirection(this.forward);
    this.forward.y = 0;
    if (this.forward.lengthSq() < 1e-8) this.forward.set(0, 0, -1);
    this.forward.normalize();
    this.right.crossVectors(this.forward, this.camera.up).normalize();
    this.move.set(0, 0, 0);
    if (this.pressed.has('KeyW')) this.move.add(this.forward);
    if (this.pressed.has('KeyS')) this.move.sub(this.forward);
    if (this.pressed.has('KeyD')) this.move.add(this.right);
    if (this.pressed.has('KeyA')) this.move.sub(this.right);
    if (this.pressed.has('KeyE')) this.move.y += 1;
    if (this.pressed.has('KeyQ')) this.move.y -= 1;
    if (this.move.lengthSq() === 0) return false;
    const boost = this.pressed.has('ShiftLeft') || this.pressed.has('ShiftRight') ? 5 : 1;
    const speed = Math.max(80, heightAboveGround * 0.8) * boost;
    this.camera.position.addScaledVector(this.move.normalize(), speed * deltaSeconds);
    return true;
  }

  /** Syncs the internal orientation from the camera when fly mode is entered. */
  syncFromCamera(): void {
    this.euler.setFromQuaternion(this.camera.quaternion);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointermove', this.onPointerMove);
  }

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (!this.enabled || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (MOVE_KEYS.has(e.code)) this.pressed.add(e.code);
  };

  private readonly onKeyUp = (e: KeyboardEvent) => this.pressed.delete(e.code);

  private readonly onBlur = () => this.pressed.clear();

  private readonly onPointerDown = (e: PointerEvent) => {
    if (this.enabled && e.button === 0) this.dragging = true;
  };

  private readonly onPointerUp = () => {
    this.dragging = false;
  };

  private readonly onPointerMove = (e: PointerEvent) => {
    if (!this.enabled || !this.dragging) return;
    this.euler.y -= e.movementX * 0.003;
    this.euler.x = Math.max(-1.5, Math.min(1.5, this.euler.x - e.movementY * 0.003));
    this.euler.z = 0;
    this.camera.quaternion.setFromEuler(this.euler);
  };
}
