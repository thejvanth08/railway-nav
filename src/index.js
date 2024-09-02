import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { Pathfinding, PathfindingHelper } from "three-pathfinding";

// SCENE
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa8def0);

// CAMERA
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 50, 0); // Top view position
camera.lookAt(0, 0, 0); // Look at the center of the scene

// RENDERER
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;

// ORBIT CONTROLS
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.mouseButtons = {
  MIDDLE: THREE.MOUSE.ROTATE,
  RIGHT: THREE.MOUSE.PAN,
};
orbitControls.enableDamping = true;
orbitControls.enablePan = true;
orbitControls.minDistance = 5;
orbitControls.maxDistance = 60;
orbitControls.maxPolarAngle = Math.PI / 2 - 0.05;
orbitControls.minPolarAngle = Math.PI / 4;
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

// LIGHTS
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

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
  new THREE.MeshStandardMaterial({ color: "green" })
);
agent.position.y = agentHeight / 2;
const agentGroup = new THREE.Group();
agentGroup.add(agent);
agentGroup.position.set(0, 1, 0);
scene.add(agentGroup);

// PATHFINDING INITIALIZATION
const pathfinding = new Pathfinding();
const pathfindingHelper = new PathfindingHelper();
scene.add(pathfindingHelper);
const ZONE = "level1";
const SPEED = 2; // Adjusted speed for smoother movement
let navmesh;
let groupID;
let navpath = []; // Initialize navpath as an empty array

// OBJECTS POSITION MAPPING
let objectsMap = {}; // Store objects and their positions

// LOAD STATION MODEL
const loader = new GLTFLoader();
const stationModel = "./glb/station-model.glb";

loader.load(stationModel, (gltf) => {
  const model = gltf.scene;
  scene.add(model);

  let pts = model.children.filter((pt) => pt.type === "Object3D");
  pts = pts.map((pt) => ({
    name: pt.name,
    position: pt.position.clone(),
  }));
  pts.forEach((pt) => {
    objectsMap[pt.name] = pt.position;
  });
  console.log(objectsMap);
  // Traverse model to find objects and store their positions
});

// LOAD NAVMESH
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

// MOVEMENT ALONG PATH
function move(delta) {
  if (!navpath || navpath.length === 0) return;

  let targetPosition = navpath[0];
  const distance = targetPosition.clone().sub(agentGroup.position);

  if (distance.length() > 0.1) {
    // If distance to the next point is significant, move closer
    const moveStep = distance.normalize().multiplyScalar(SPEED * delta);
    agentGroup.position.add(moveStep);

    // Calculate camera position
    const cameraOffset = new THREE.Vector3(0, 2, -5); // Offset behind and above the agent
    camera.position.copy(agentGroup.position).add(cameraOffset);

    // Ensure the camera looks in the same direction as the agent's movement
    const movementDirection = distance.normalize();
    const lookAtPosition = agentGroup.position.clone().add(movementDirection);
    camera.lookAt(lookAtPosition);
  } else {
    // Reached current target, proceed to the next one
    navpath.shift();

    // Check if we have reached the final destination
    if (navpath.length === 0) {
      speak("Destination is reached!"); // Trigger voice alert
      alert("Destination is reached!"); // Optional: keep the text alert as well
    }
  }
}

// GAME LOOP
const clock = new THREE.Clock();
function gameLoop() {
  move(clock.getDelta());
  renderer.render(scene, camera);
  requestAnimationFrame(gameLoop);
}
gameLoop();

// NAVIGATION HANDLER
document.getElementById("setAgentButton").addEventListener("click", () => {
  const startPointName = document.getElementById("startDropdown").value;
  const destinationName = document.getElementById("destinationDropdown").value;

  if (!startPointName || !destinationName) {
    alert("Please select both start and destination points.");
    speak("Please select both start and destination points.");
    return;
  }

  const start = objectsMap[startPointName];
  const destination = objectsMap[destinationName];
  speak(`navigating from ${startPointName} to ${destinationName}`);

  if (!start || !destination) {
    alert("Invalid points selected.");
    speak("Invalid points selected.");
    return;
  }

  // Move agent to the starting position
  agentGroup.position.copy(start);
  groupID = pathfinding.getGroup(ZONE, agentGroup.position);

  const closestStart = pathfinding.getClosestNode(start, ZONE, groupID);
  const closestEnd = pathfinding.getClosestNode(destination, ZONE, groupID);

  navpath = pathfinding.findPath(
    closestStart.centroid,
    closestEnd.centroid,
    ZONE,
    groupID
  );

  if (navpath) {
    pathfindingHelper.reset();
    pathfindingHelper.setPlayerPosition(start);
    pathfindingHelper.setTargetPosition(destination);
    pathfindingHelper.setPath(navpath);
  } else {
    alert("No path found!");
  }
});

// VOICE ALERT FUNCTION
function speak(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.pitch = 1; // Optional: set pitch
  utterance.rate = 1; // Optional: set rate
  utterance.volume = 1; // Optional: set volume
  window.speechSynthesis.speak(utterance);
}
