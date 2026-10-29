import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Display-only replay of the atlas's centimetre-quantized capsule endpoints.
// Recorded clearance metrics are never recomputed from this reduced geometry.
export function createViewer(host, data, options) {
  const decode = value => {
    const binary = atob(value), bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const raw = new DataView(bytes.buffer), result = new Int16Array(bytes.length / 2);
    for (let i = 0; i < result.length; i++) result[i] = raw.getInt16(i * 2, true);
    return result;
  };
  const count = data.radius.length, targetArray = decode(data.caps_t), altArray = decode(data.caps_a);
  if (!count || targetArray.length % (count * 6) || targetArray.length !== altArray.length) throw new Error('Invalid geometry');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const canvas = renderer.domElement; canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', '3D atlas pair. Drag or use arrow keys to orbit; plus and minus to zoom; Home to reset.');
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#eef2f0');
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 80); camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.minDistance = 1; controls.maxDistance = 25; controls.maxPolarAngle = Math.PI * .48;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x82938b, 2.1));
  const light = new THREE.DirectionalLight(0xffffff, 2); light.position.set(3, -5, 8); scene.add(light);
  const grid = new THREE.GridHelper(30, 60, 0xc3d1c9, 0xd7e1dc); grid.rotation.x = Math.PI / 2; scene.add(grid);
  const root = new THREE.Group(); scene.add(root);
  const geometries = new Set(), materials = new Set();
  const mesh = (geometry, material) => {
    geometries.add(geometry); materials.add(material); const m = new THREE.Mesh(geometry, material); root.add(m); return m;
  };
  const altMat = new THREE.MeshStandardMaterial({ color: 0x87938e, transparent: true, opacity: .35, depthWrite: false, roughness: .6 });
  function robot(array, material) {
    const parts = data.radius.map((radius, i) => {
      const o = i * 6, length = Math.hypot(array[o + 3] - array[o], array[o + 4] - array[o + 1], array[o + 5] - array[o + 2]) / 100;
      return mesh(length < .004 ? new THREE.SphereGeometry(radius / 100, 12, 8) : new THREE.CapsuleGeometry(radius / 100, length, 4, 10), material);
    });
    return { array, parts, frames: array.length / (count * 6) };
  }
  const target = robot(targetArray, new THREE.MeshStandardMaterial({ color: 0x087f78, metalness: .08, roughness: .5 }));
  const alternative = robot(altArray, altMat);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), direction = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  function pose(body, frame) {
    const f = Math.max(0, Math.min(frame, body.frames - 1)), f0 = Math.floor(f), f1 = Math.min(f0 + 1, body.frames - 1), u = f - f0;
    body.parts.forEach((part, i) => {
      const o0 = (f0 * count + i) * 6, o1 = (f1 * count + i) * 6, A = body.array;
      a.set(A[o0] * (1 - u) + A[o1] * u, A[o0 + 1] * (1 - u) + A[o1 + 1] * u, A[o0 + 2] * (1 - u) + A[o1 + 2] * u).multiplyScalar(.01);
      b.set(A[o0 + 3] * (1 - u) + A[o1 + 3] * u, A[o0 + 4] * (1 - u) + A[o1 + 4] * u, A[o0 + 5] * (1 - u) + A[o1 + 5] * u).multiplyScalar(.01);
      part.position.copy(a).add(b).multiplyScalar(.5); direction.copy(b).sub(a);
      if (direction.lengthSq() > 1e-8) part.quaternion.setFromUnitVectors(up, direction.normalize());
    });
  }
  const points = [];
  for (let f = 0; f < target.frames; f++) {
    let x = 0, y = 0;
    for (let i = 0; i < count; i++) { const o = (f * count + i) * 6; x += targetArray[o] + targetArray[o + 3]; y += targetArray[o + 1] + targetArray[o + 4]; }
    points.push(new THREE.Vector3(x / (count * 200), y / (count * 200), .01));
  }
  const trailGeo = new THREE.BufferGeometry().setFromPoints(points), trailMat = new THREE.LineBasicMaterial({ color: 0x71aea0 });
  geometries.add(trailGeo); materials.add(trailMat); root.add(new THREE.Line(trailGeo, trailMat));
  data.boxes.forEach(box => {
    const tall = box.zt > 1.3 && ['ground', 'low'].includes(box.kind);
    const m = mesh(new THREE.BoxGeometry(box.hx * 2, box.hy * 2, Math.max(.01, box.zt - box.zb)),
      new THREE.MeshStandardMaterial({ color: 0xdba151, roughness: .7, transparent: true, opacity: tall ? .35 : .8, depthWrite: !tall }));
    m.position.set(box.cx, box.cy, (box.zb + box.zt) / 2); m.rotation.z = box.yaw;
    const edgeGeo = new THREE.EdgesGeometry(m.geometry), edgeMat = new THREE.LineBasicMaterial({ color: 0xb8833c, transparent: true, opacity: .7 });
    geometries.add(edgeGeo); materials.add(edgeMat);
    const edges = new THREE.LineSegments(edgeGeo, edgeMat); edges.position.copy(m.position); edges.rotation.copy(m.rotation); root.add(edges);
  });
  pose(target, 0); pose(alternative, 0);
  const bounds = new THREE.Box3().setFromObject(root);
  points.forEach(point => bounds.expandByPoint(point));
  const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3()); center.z = Math.min(center.z, .8);
  const p0 = points[0], p1 = points.at(-1), travel = p1.clone().sub(p0).setZ(0);
  if (travel.length() < .1) travel.set(1, 0, 0); travel.normalize();
  function reset() {
    const extent = Math.max(2.9, size.x, size.y, size.z * 1.5) * Math.max(1, 1 / camera.aspect);
    controls.target.copy(center);
    camera.position.set(center.x - travel.x * extent + travel.y * extent * .8, center.y - travel.y * extent - travel.x * extent * .8, extent * .75);
    controls.update();
  }
  let firstSize = true;
  function resize() {
    const width = host.clientWidth, height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    if (firstSize) { reset(); firstSize = false; }
  }
  host.append(canvas); resize();
  const observer = new ResizeObserver(resize); observer.observe(host);
  const spherical = new THREE.Spherical();
  function keydown(event) {
    if (event.key === 'Home') { event.preventDefault(); reset(); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_'].includes(event.key)) return;
    event.preventDefault(); const offset = camera.position.clone().sub(controls.target);
    // Orbit in a y-up frame, then restore the atlas's z-up coordinates.
    offset.set(offset.x, offset.z, -offset.y); spherical.setFromVector3(offset);
    if (event.key === 'ArrowLeft') spherical.theta -= .12;
    if (event.key === 'ArrowRight') spherical.theta += .12;
    if (event.key === 'ArrowUp') spherical.phi -= .1;
    if (event.key === 'ArrowDown') spherical.phi += .1;
    if (['+', '='].includes(event.key)) spherical.radius *= .9;
    if (['-', '_'].includes(event.key)) spherical.radius *= 1.1;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, .05, Math.PI * .48); spherical.radius = THREE.MathUtils.clamp(spherical.radius, 1, 25);
    offset.setFromSpherical(spherical); camera.position.copy(controls.target).add(new THREE.Vector3(offset.x, -offset.z, offset.y)); controls.update();
  }
  canvas.addEventListener('keydown', keydown);
  let playing = !options.reducedMotion, alternativeVisible = options.alternative, frame = options.reducedMotion ? Math.min(35, target.frames - 1) : 0;
  let last = performance.now(), animation, disposed = false;
  const setPlaying = value => { playing = value; options.onPlay(value); };
  setPlaying(playing);
  function draw(now) {
    if (disposed) return;
    animation = requestAnimationFrame(draw); const dt = Math.min((now - last) / 1000, .1); last = now;
    if (document.hidden) return;
    if (playing) frame = (frame + dt * 50 / 3 * .75) % (target.frames + 12);
    const f = Math.min(frame, target.frames - 1), hit = data.hit, blocked = hit !== null && hit !== undefined && f >= hit;
    pose(target, f); pose(alternative, blocked ? hit : f);
    alternative.parts.forEach(part => { part.visible = alternativeVisible; });
    altMat.color.setHex(blocked ? 0xb64444 : 0x87938e); altMat.opacity = blocked ? .68 : .35;
    options.onFrame(Math.round(f / (target.frames - 1) * 1000));
    controls.update(); renderer.render(scene, camera);
  }
  animation = requestAnimationFrame(draw);
  return {
    toggle() { setPlaying(!playing); }, pause() { setPlaying(false); },
    seek(fraction) { frame = fraction * (target.frames - 1); setPlaying(false); },
    setAlternative(value) { alternativeVisible = value; }, reset,
    dispose() {
      disposed = true; cancelAnimationFrame(animation); observer.disconnect(); controls.dispose(); canvas.removeEventListener('keydown', keydown);
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); grid.geometry.dispose(); grid.material.dispose();
      renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    },
  };
}
