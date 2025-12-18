
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GRID_SIZE } from './QAgent';

// Vertex Shader
const vertexShader = `
uniform float uTime;
uniform sampler2D uHeightMap;
uniform float uHeightScale;

varying float vHeight;
varying vec2 vUv;

void main() {
  vUv = uv;

  // Sample height from texture
  vec4 heightData = texture2D(uHeightMap, uv);
  float height = heightData.r; // We'll store normalized height in R channel

  vHeight = height;

  vec3 pos = position;
  pos.z = height * uHeightScale;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

// Fragment Shader
const fragmentShader = `
uniform float uTime;
varying float vHeight;
varying vec2 vUv;
uniform vec3 uColorLow;
uniform vec3 uColorHigh;
uniform vec2 uAgentPos; // In UV coordinates (0-1)
uniform float uPulseRadius;

void main() {
  // Color based on height
  vec3 color = mix(uColorLow, uColorHigh, vHeight);

  // Grid lines
  float gridScale = ${GRID_SIZE}.0;
  vec2 grid = abs(fract(vUv * gridScale - 0.5) - 0.5) / fwidth(vUv * gridScale);
  float line = min(grid.x, grid.y);
  float gridIntensity = 1.0 - min(line, 1.0);

  color = mix(color, vec3(0.5, 0.8, 1.0), gridIntensity * 0.3);

  // Pulse effect around agent
  float dist = distance(vUv, uAgentPos);
  float pulse = 0.0;
  if (dist < uPulseRadius) {
     float wave = sin(dist * 50.0 - uTime * 5.0) * 0.5 + 0.5;
     float falloff = 1.0 - dist / uPulseRadius;
     pulse = wave * falloff * 0.5;
  }

  color += vec3(0.2, 0.8, 1.0) * pulse;

  gl_FragColor = vec4(color, 1.0);
}
`;

interface LandscapeProps {
  qValues: Float32Array; // Flattened array of max Q values for each cell
  agentPos: { x: number; y: number };
  onClick: (x: number, y: number) => void;
}

export const Landscape: React.FC<LandscapeProps> = ({ qValues, agentPos, onClick }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Data texture to store height map
  const dataTexture = useMemo(() => {
    const data = new Float32Array(GRID_SIZE * GRID_SIZE * 4); // RGBA
    const texture = new THREE.DataTexture(
        data,
        GRID_SIZE,
        GRID_SIZE,
        THREE.RGBAFormat,
        THREE.FloatType
    );
    texture.minFilter = THREE.LinearFilter; // Bilinear smoothing
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }, []);

  useFrame((state) => {
    if (!materialRef.current || !meshRef.current) return;

    materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    materialRef.current.uniforms.uAgentPos.value.set(
        (agentPos.x + 0.5) / GRID_SIZE,
        (agentPos.y + 0.5) / GRID_SIZE
    );

    // Update texture data from qValues
    // We need to normalize qValues for visualization or just pass raw and scale in shader?
    // Let's pass raw values normalized roughly to 0-1 range for color mixing,
    // but we need to handle negative values (pits) and positive (goals).
    // Let's map -10 to +10 range to 0 to 1 range for texture R channel?
    // Or just pass value directly and handle scaling in shader/uniforms.
    // Texture is FloatType, so it can hold arbitrary values.

    const data = dataTexture.image.data;
    let minQ = -10;
    let maxQ = 10;

    // Dynamic range adjustment could be cool but might be jittery.
    // Let's stick to fixed range for now based on rewards.

    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
        // Map qValues[i] to data
        // qValues is 1D array of maxQ per cell (passed from parent)
        // Texture coordinate system: usually (0,0) is bottom-left.
        // Our grid (0,0) is top-left usually in array logic?
        // Let's assume standard mapping and fix if inverted.

        let val = qValues[i];

        // Normalize for color mixing (0 to 1)
        // -15 to 15 range to be safe
        let normVal = (val - (-15)) / (15 - (-15));
        normVal = Math.max(0, Math.min(1, normVal));

        data[i * 4] = normVal; // R channel for height/color
        data[i * 4 + 1] = 0;
        data[i * 4 + 2] = 0;
        data[i * 4 + 3] = 1;
    }
    dataTexture.needsUpdate = true;
  });

  const handleClick = (e: THREE.Event) => {
    e.stopPropagation();
    // Convert uv to grid coordinates
    if (e.uv) {
        const x = Math.floor(e.uv.x * GRID_SIZE);
        const y = Math.floor(e.uv.y * GRID_SIZE);
        onClick(x, y);
    }
  };

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uHeightMap: { value: dataTexture },
    uHeightScale: { value: 5.0 }, // Maximum height displacement
    uColorLow: { value: new THREE.Color('#2a003b') }, // Dark Purple/Obsidian
    uColorHigh: { value: new THREE.Color('#00ffff') }, // Neon Cyan
    uAgentPos: { value: new THREE.Vector2(0, 0) },
    uPulseRadius: { value: 0.3 },
  }), [dataTexture]);

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={handleClick}
      onPointerOver={() => document.body.style.cursor = 'pointer'}
      onPointerOut={() => document.body.style.cursor = 'auto'}
    >
      {/* High segment density for smooth vertex displacement */}
      <planeGeometry args={[20, 20, 100, 100]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={true}
      />
    </mesh>
  );
};
