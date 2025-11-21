// LottoTumblerScript.js
// Fully module-compatible version using globals:
//   window.THREE, window.OrbitControls, window.CANNON
// jQuery is assumed loaded in HTML

// -------------------------------------------------------
// Use globals instead of importing again
// -------------------------------------------------------


//const THREE = window.THREE; //***COMMENTED OUT: THIS IS THE THING THAT WASN'T WORKING BEFORE I THINK


import * as THREE from "three";      // import via importmap
// OrbitControls already attached to window
const OrbitControls = window.OrbitControls;
const CANNON = window.CANNON;


// -------------------------------------------------------
// Helper functions
// -------------------------------------------------------
function rand(min, max) {
  return Math.random() * (max - min) + min;
}

// -------------------------------------------------------
// Scene / Renderer / Camera
// -------------------------------------------------------
$(document).ready(() => {
  const container = document.getElementById('viewer');
  const width = 640, height = 640;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x071020);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
  camera.position.set(0, 180, 420);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 20, 0);
  controls.update();

  // Lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x080820, 0.9);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(100, 300, 200);
  dir.castShadow = true;
  dir.shadow.camera.near = 1;
  dir.shadow.camera.far = 1000;
  scene.add(dir);

  // -------------------------------------------------------
  // Physics world
  // -------------------------------------------------------
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.solver.iterations = 10;
  const timeStep = 1 / 60;
  const gravityScale = 80.0;

  // -------------------------------------------------------
  // Tumbler geometry + physics Trimesh
  // -------------------------------------------------------
  const TUMBLER_RADIUS = 220;
  const TUMBLER_THICKNESS = 6;

  const innerSphereGeo = new THREE.SphereGeometry(TUMBLER_RADIUS, 48, 48);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.0,
    roughness: 0.05,
    transmission: 0.9,
    opacity: 1,
    transparent: true,
    side: THREE.DoubleSide
  });
  const glassMesh = new THREE.Mesh(innerSphereGeo, glassMat);
  glassMesh.castShadow = false;
  glassMesh.receiveShadow = true;
  glassMesh.position.set(0, 0, 0);
  scene.add(glassMesh);

  function threeGeomToTrimesh(geom) {
    const bufferGeom = geom.isBufferGeometry ? geom : new THREE.BufferGeometry().fromGeometry(geom);
    const pos = bufferGeom.attributes.position.array;
    const indices = bufferGeom.index ? bufferGeom.index.array : null;

    const vertices = [];
    for (let i = 0; i < pos.length; i++) vertices.push(pos[i]);

    const faces = [];
    if (indices) {
      for (let i = 0; i < indices.length; i += 3) faces.push([indices[i], indices[i + 1], indices[i + 2]]);
    } else {
      for (let i = 0; i < vertices.length / 3; i += 3) faces.push([i, i + 1, i + 2]);
    }

    const vertFlat = new Float32Array(vertices);
    const indexFlat = new Int32Array(faces.length * 3);
    for (let i = 0; i < faces.length; i++) {
      indexFlat[i * 3 + 0] = faces[i][0];
      indexFlat[i * 3 + 1] = faces[i][1];
      indexFlat[i * 3 + 2] = faces[i][2];
    }
    return { verts: vertFlat, indices: indexFlat };
  }

  const sphereTM = threeGeomToTrimesh(innerSphereGeo);
  const trimeshShape = new CANNON.Trimesh(Array.from(sphereTM.verts), Array.from(sphereTM.indices));
  const sphereBody = new CANNON.Body({ mass: 0 });
  sphereBody.addShape(trimeshShape);
  sphereBody.position.set(0, 0, 0);
  world.addBody(sphereBody);

  // -------------------------------------------------------
  // Balls
  // -------------------------------------------------------
  const ballMeshes = [];
  const ballBodies = [];

  function createBallMesh(radius, color) {
    const geo = new THREE.SphereGeometry(radius, 24, 24);
    const mat = new THREE.MeshStandardMaterial({ color: color, metalness: 0.1, roughness: 0.4 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
  }

  function spawnBall(id, x, y, z, r, number) {
    const mesh = createBallMesh(r, 0xffffff);
    mesh.position.set(x, y, z);
    scene.add(mesh);

    const body = new CANNON.Body({
      mass: r * r * 0.01,
      shape: new CANNON.Sphere(r),
      position: new CANNON.Vec3(x, y, z),
      linearDamping: 0.01,
      angularDamping: 0.01
    });
    world.addBody(body);

    ballMeshes.push({ mesh, id, number });
    ballBodies.push({ body, r, number, id });
  }

  function populateBalls(count) {
    for (const bm of ballMeshes) scene.remove(bm.mesh);
    while (ballBodies.length) world.removeBody(ballBodies.pop().body);
    ballMeshes.length = 0;

    const radRange = [14, 20];
    let id = 1;
    for (let i = 0; i < count; i++) {
      const r = Math.round(rand(radRange[0], radRange[1]));
      const theta = rand(0, Math.PI * 2);
      const rr = rand(0, TUMBLER_RADIUS * 0.4);
      const x = Math.cos(theta) * rr;
      const z = Math.sin(theta) * rr;
      const y = -TUMBLER_RADIUS + r + 10 + rand(0, 6);
      spawnBall(id, x, y, z, r, id);
      id++;
    }
  }

  // -------------------------------------------------------
  // Mechanical arm
  // -------------------------------------------------------
  const armLength = TUMBLER_RADIUS * 1.8;
  const armGeom = new THREE.BoxGeometry(armLength, 10, 12);
  const armMat = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.8, roughness: 0.25 });
  const armMesh = new THREE.Mesh(armGeom, armMat);
  armMesh.castShadow = true;
  armMesh.receiveShadow = true;
  armMesh.position.set(0, 0, 0);
  scene.add(armMesh);

  const studs = [];
  function createStuds(count) {
    for (const s of studs) scene.remove(s.mesh);
    studs.length = 0;
    for (let i = 0; i < count; i++) {
      const phi = rand(0, Math.PI);
      const theta = rand(0, Math.PI * 2);
      const sx = Math.sin(phi) * Math.cos(theta) * (TUMBLER_RADIUS - 8);
      const sy = Math.cos(phi) * (TUMBLER_RADIUS - 8);
      const sz = Math.sin(phi) * Math.sin(theta) * (TUMBLER_RADIUS - 8);

      const g = new THREE.SphereGeometry(8, 12, 12);
      const m = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.2 });
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(sx, sy, sz);
      scene.add(mesh);
      studs.push({ mesh, pos: new THREE.Vector3(sx, sy, sz) });
    }
  }

  // -------------------------------------------------------
  // Chute
  // -------------------------------------------------------
  const chuteGeo = new THREE.RingGeometry(12, 18, 32);
  const chuteMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
  const chuteMesh = new THREE.Mesh(chuteGeo, chuteMat);
  chuteMesh.rotation.x = -Math.PI / 2;
  chuteMesh.position.set(0, TUMBLER_RADIUS - 10, 0);
  scene.add(chuteMesh);

  // -------------------------------------------------------
  // Simulation vars
  // -------------------------------------------------------
  let isSpinning = false;
  let totalRotationsTarget = parseFloat($('#autoRotations').val()) || 3;
  let spinPower = parseFloat($('#spinPower').val()) || 1.0;
  let rotationsAccum = 0;
  let containerSpinRate = 0;
  let armSpinRate = 0;
  const armWidth = 12;

  // -------------------------------------------------------
  // Main animation loop
  // -------------------------------------------------------
  let lastFrameTime = performance.now();

  function animate() {
    const now = performance.now();
    const dtSeconds = Math.min(1 / 30, (now - lastFrameTime) / 1000);
    lastFrameTime = now;

    // rotate tumbler and arm
    if (isSpinning) {
      glassMesh.rotation.y += containerSpinRate * dtSeconds;
      armMesh.rotation.y += armSpinRate * dtSeconds;
      for (const s of studs) s.mesh.rotation.y += armSpinRate * dtSeconds * 0.5;

      rotationsAccum += Math.abs(containerSpinRate * dtSeconds);
      if (rotationsAccum >= 2 * Math.PI * totalRotationsTarget) {
        stopSpinAndPick();
        rotationsAccum = 0;
      }
    } else {
      glassMesh.rotation.y *= 0.995;
      armMesh.rotation.y *= 0.995;
    }

    // physics gravity rotation
    const baseGravity = new CANNON.Vec3(0, -1 * gravityScale, 0);
    const ang = glassMesh.rotation.y;
    const c = Math.cos(ang), s = Math.sin(ang);
    const grot = new CANNON.Vec3(baseGravity.x * c + baseGravity.z * s, baseGravity.y, -baseGravity.x * s + baseGravity.z * c);
    world.gravity.set(grot.x, grot.y, grot.z);

    // apply arm impulses + studs impulses
    // ... rest of your physics code unchanged ...

    world.step(timeStep, dtSeconds);

    // sync ball meshes with bodies
    for (let i = 0; i < ballBodies.length; i++) {
      const pb = ballBodies[i];
      const bm = ballMeshes[i].mesh;
      bm.position.copy(pb.body.position);
      bm.quaternion.copy(pb.body.quaternion);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  // -------------------------------------------------------
  // UI wiring
  // -------------------------------------------------------
  $('#spinBtn').on('click', () => {
    if (isSpinning) return;
    if (!studs.length) createStuds(10);
    if (!ballBodies.length) populateBalls(parseInt($('#ballCount').val() || 24));

    isSpinning = true;
    rotationsAccum = 0;
    totalRotationsTarget = parseFloat($('#autoRotations').val()) || 3;
    containerSpinRate = parseFloat($('#spinPower').val()) * 1.0 + rand(-0.2, 0.2);
    armSpinRate = containerSpinRate * 1.6 + rand(-0.2, 0.2);
  });

  populateBalls(parseInt($('#ballCount').val() || 24));
  createStuds(8);
  animate();

}); // end document ready
