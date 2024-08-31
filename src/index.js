import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { Pathfinding, PathfindingHelper } from "three-pathfinding";

// SCENE
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa8def0); // Set a solid color background or another texture/material if needed

// CAMERA
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(33, 10, 10);

// RENDERER
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;

// ORBIT CAMERA CONTROLS
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.mouseButtons = {
  MIDDLE: THREE.MOUSE.ROTATE,
  RIGHT: THREE.MOUSE.PAN,
};
orbitControls.enableDamping = true;
orbitControls.enablePan = true;
orbitControls.minDistance = 5;
orbitControls.maxDistance = 60;
orbitControls.maxPolarAngle = Math.PI / 2 - 0.05; // prevent camera below ground
orbitControls.minPolarAngle = Math.PI / 4; // prevent top down view
orbitControls.update();

// ATTACH RENDERER
document.body.appendChild(renderer.domElement);

// RESIZE HANDLER
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onWindowResize);

// AMBIENT LIGHT
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Increase intensity
scene.add(ambientLight);

// ADDITIONAL LIGHTS
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7).normalize();
scene.add(directionalLight);

const pointLight = new THREE.PointLight(0xffffff, 1, 50);
pointLight.position.set(10, 10, 10);
scene.add(pointLight);

// AGENT
const agentHeight = 1.0;
const agentRadius = 0.25;
const agent = new THREE.Mesh(
  new THREE.CylinderGeometry(agentRadius, agentRadius, agentHeight),
  new THREE.MeshStandardMaterial({ color: "green" }), // Use MeshStandardMaterial for better lighting response
);
agent.position.y = agentHeight / 2;
const agentGroup = new THREE.Group();
agentGroup.add(agent);
agentGroup.position.set(0, 1, 0);
scene.add(agentGroup);

// LOAD LEVEL
const loader = new GLTFLoader();
const stationModel = "./glb/station-model.glb";

loader.load(stationModel, (gltf) => {
  scene.add(gltf.scene);
});

// INITIALIZE THREE-PATHFINDING
const pathfinding = new Pathfinding();
const pathfindingHelper = new PathfindingHelper();
scene.add(pathfindingHelper);
const ZONE = "level1";
const SPEED = 5;
let navmesh;
let groupID;
let navpath;
const stationNavMesh = "./glb/station-navmesh.glb";

loader.load(stationNavMesh, (gltf) => {
  gltf.scene.traverse((node) => {
    if (
      !navmesh &&
      node.isObject3D &&
      node.children &&
      node.children.length > 0
    ) {
      navmesh = node.children[0];
      pathfinding.setZoneData(ZONE, Pathfinding.createZone(navmesh.geometry));
    }
  });
});

// RAYCASTING
const raycaster = new THREE.Raycaster(); // create once
const clickMouse = new THREE.Vector2(); // create once

function intersect(pos) {
  raycaster.setFromCamera(pos, camera);
  return raycaster.intersectObjects(scene.children);
}
window.addEventListener("click", (event) => {
  clickMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  clickMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  const found = intersect(clickMouse);
  if (found.length > 0) {
    let target = found[0].point;
    const agentpos = agentGroup.position;

    groupID = pathfinding.getGroup(ZONE, agentGroup.position);
    // find closest node to agent, just in case agent is out of bounds
    const closest = pathfinding.getClosestNode(agentpos, ZONE, groupID);
    navpath = pathfinding.findPath(closest.centroid, target, ZONE, groupID);
    if (navpath) {
      pathfindingHelper.reset();
      pathfindingHelper.setPlayerPosition(agentpos);
      pathfindingHelper.setTargetPosition(target);
      pathfindingHelper.setPath(navpath);
    }
  }
});

// MOVEMENT ALONG PATH
function move(delta) {
  if (!navpath || navpath.length <= 0) return;

  let targetPosition = navpath[0];
  const distance = targetPosition.clone().sub(agentGroup.position);

  if (distance.lengthSq() > 0.05 * 0.05) {
    distance.normalize();
    // Move player to target
    agentGroup.position.add(distance.multiplyScalar(delta * SPEED));
  } else {
    // Remove node from the path we calculated
    navpath.shift();
  }
}

// GAMELOOP
const clock = new THREE.Clock();
function gameLoop() {
  move(clock.getDelta());
  orbitControls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(gameLoop);
}
gameLoop();
