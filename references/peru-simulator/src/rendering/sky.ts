import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, type Vector3 } from 'three';

/** Camera-following gradient sky dome drawn behind everything. */
export class Sky {
  readonly mesh: Mesh<SphereGeometry, ShaderMaterial>;

  constructor(horizon: Color, zenith = new Color(0x2f5d8f)) {
    const material = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      depthTest: false,
      uniforms: { uHorizon: { value: horizon }, uZenith: { value: zenith } },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uHorizon;
        uniform vec3 uZenith;
        varying vec3 vDir;
        void main() {
          float t = smoothstep(-0.05, 0.45, vDir.y);
          gl_FragColor = vec4(mix(uHorizon, uZenith, t), 1.0);
        }`,
    });
    this.mesh = new Mesh(new SphereGeometry(1000, 32, 16), material);
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;
  }

  follow(cameraPosition: Vector3): void {
    this.mesh.position.copy(cameraPosition);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
