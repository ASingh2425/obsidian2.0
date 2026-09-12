import * as THREE from 'three';
import type { Vector3Tuple } from '../../types/sceneTypes';

export type CameraPreset = 'OVERVIEW' | 'FOCUS' | 'RESET';

// Immersive spatial camera position matching the authoritative Obsidian 2.0 visual target
// Places the viewer inside the analytical environment with genuine foreground, midground, and background depth
export const DEFAULT_CAMERA_POS = new THREE.Vector3(-4.5, 3.2, 14.5);
export const DEFAULT_LOOK_AT = new THREE.Vector3(0.3, 0.5, 0.0);

export function computeTargetCameraPosition(
  preset: CameraPreset,
  targetPosition?: Vector3Tuple,
): { pos: THREE.Vector3; lookAt: THREE.Vector3 } {
  if (preset === 'FOCUS' && targetPosition) {
    return {
      pos: new THREE.Vector3(
        targetPosition[0] - 2.0,
        targetPosition[1] + 1.2,
        Math.max(6.0, targetPosition[2] + 7.5),
      ),
      lookAt: new THREE.Vector3(
        targetPosition[0],
        targetPosition[1] + 0.1,
        targetPosition[2],
      ),
    };
  }

  return {
    pos: DEFAULT_CAMERA_POS.clone(),
    lookAt: DEFAULT_LOOK_AT.clone(),
  };
}
