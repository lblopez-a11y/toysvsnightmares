import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
// Procedural studio reflection map, generated once. No external HDR download.
export function createStudioEnvironment(renderer){const generator=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();const result=generator.fromScene(room,.04);room.dispose();generator.dispose();return result;}
