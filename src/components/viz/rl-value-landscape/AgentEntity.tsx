
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GRID_SIZE } from './QAgent';

interface AgentEntityProps {
  x: number;
  y: number;
  qValues: Float32Array;
}

export const AgentEntity: React.FC<AgentEntityProps> = ({ x, y, qValues }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      // Interpolate position for smooth movement
      const targetX = (x / GRID_SIZE) * 20 - 10 + (0.5 * 20 / GRID_SIZE); // Map 0..GRID_SIZE to -10..10
      // In Three.js, y is usually up. But our grid is on XZ plane.
      // x grid -> x world
      // y grid -> -z world (or z world)

      // Let's align with Landscape UV mapping.
      // UV (0,0) is bottom-left geometry.
      // PlaneGeometry(20, 20) is centered at 0,0. Extends from -10 to 10.

      // UV x=0 -> world x=-10
      // UV x=1 -> world x=10
      // UV y=0 -> world y=-10 (in 2D plane local coords, which is -z in world after rotation)

      // Let's assume grid(0,0) corresponds to uv(0,0) for simplicity in shader logic.
      const worldX = (x / GRID_SIZE) * 20 - 10 + (20 / GRID_SIZE) / 2;
      const worldZ = -((y / GRID_SIZE) * 20 - 10 + (20 / GRID_SIZE) / 2); // Negate Z because plane is rotated -PI/2
      // Actually, if we rotate -PI/2 around X:
      // Local (x, y, z) -> World (x, z, -y) essentially.
      // Plane created in XY plane.
      // Grid X -> Plane X
      // Grid Y -> Plane Y

      // Let's just strictly map:
      // Grid X (0..19) -> World X (-10..10)
      // Grid Y (0..19) -> World Z (-10..10)
      // Be careful with orientation. Let's align with UVs.
      // UV x goes 0->1. Grid x 0->19.
      // UV y goes 0->1. Grid y 0->19.

      // PlaneGeometry uvs: (0,1) top-left, (1,1) top-right ? Standard is (0,0) bottom-left.
      // Let's re-verify Standard Plane UVs.
      // Bottom-Left (-10, -10) is (0,0).
      // Top-Right (10, 10) is (1,1).

      // So Grid(0,0) being "Top-Left" usually implies we want to map it to...
      // Let's just map x->x and y->y (bottom-up) for simplicity, or invert y if we want top-down.
      // Let's say Grid(0,0) is bottom-left for now.

      const targetWorldX = (x / GRID_SIZE) * 20 - 10 + (20 / GRID_SIZE) * 0.5;
      const targetWorldZ = -((y / GRID_SIZE) * 20 - 10 + (20 / GRID_SIZE) * 0.5); // Invert Z to match standard "forward is negative Z" or just match plane rotation.

      // Actually, since plane is rotated -90 deg X:
      // Plane Y becomes World -Z (wait, right hand rule)
      // Rot X -90:
      // y -> z
      // z -> -y
      // So Plane Y+ becomes World Z+ ?
      // No.
      // cos(-90) = 0, -sin(-90) = 1
      // y' = y*0 - z*1 = -z (if z was up).
      // z' = y*1 + z*0 = y.
      // So Plane Y+ becomes World Z+.

      // So if grid y increases, World Z increases.
      const targetWorldZ_Correct = (y / GRID_SIZE) * 20 - 10 + (20 / GRID_SIZE) * 0.5;


      // Height calculation
      // Get maxQ for current cell
      const idx = y * GRID_SIZE + x; // Fixed to match RLValueLandscape: y * width + x
      const val = qValues[idx] || 0;

      // Map value to height using same logic as shader
      // normVal = (val - (-15)) / 30
      // height = normVal * uHeightScale (5.0)
      const normVal = Math.max(0, Math.min(1, (val + 15) / 30));
      const targetHeight = normVal * 5.0 + 0.5; // Hover slightly above (0.5 radius)

      groupRef.current.position.x += (targetWorldX - groupRef.current.position.x) * 0.2;
      groupRef.current.position.z += (targetWorldZ_Correct - groupRef.current.position.z) * 0.2;
      groupRef.current.position.y += (targetHeight - groupRef.current.position.y) * 0.2;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial
            color="#ff00ff"
            emissive="#ff00ff"
            emissiveIntensity={2}
            toneMapped={false}
        />
      </mesh>
      <pointLight distance={5} intensity={5} color="#00ffff" />
    </group>
  );
};
