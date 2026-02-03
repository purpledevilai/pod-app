import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useSharedValue,
  useFrameCallback,
} from 'react-native-reanimated';

interface OrbProps {
  size?: number;
  color?: string;
}

interface RingConfig {
  // Ellipse shape
  radiusX: number;
  radiusY: number;
  // Rotation
  rotationSpeed: number; // radians per second
  rotationOffset: number; // initial rotation
  // Wave deformation
  waves: Array<{
    frequency: number; // how many bumps around the circle
    amplitude: number; // how much the bump distorts the radius
    speed: number; // how fast this wave animates
    phase: number; // initial phase offset
  }>;
  // 3D tilt (makes it look like a tilted ring in space)
  tiltX: number; // tilt around X axis (0 to 1, where 1 = 90 degrees)
  tiltY: number; // tilt around Y axis
}

const NUM_POINTS = 80; // Number of points to draw each ring (more = smoother)

/**
 * Generate a deformed ellipse path using sine wave superposition
 */
function generateRingPath(
  centerX: number,
  centerY: number,
  config: RingConfig,
  time: number
): ReturnType<typeof Skia.Path.Make> {
  'worklet';
  const path = Skia.Path.Make();

  // Current rotation angle based on time
  const rotation = config.rotationOffset + time * config.rotationSpeed;
  const cosRotation = Math.cos(rotation);
  const sinRotation = Math.sin(rotation);

  for (let i = 0; i <= NUM_POINTS; i++) {
    const angle = (i / NUM_POINTS) * Math.PI * 2;

    // Calculate wave deformation - sum of multiple sine waves
    let radiusOffset = 0;
    for (const wave of config.waves) {
      radiusOffset +=
        Math.sin(angle * wave.frequency + time * wave.speed + wave.phase) *
        wave.amplitude;
    }

    // Base ellipse radius at this angle
    const baseRadiusX = config.radiusX + radiusOffset;
    const baseRadiusY = config.radiusY + radiusOffset * 0.7; // Slightly different Y deformation

    // Calculate point on ellipse
    let x = Math.cos(angle) * baseRadiusX;
    let y = Math.sin(angle) * baseRadiusY;

    // Apply 3D tilt effect (simple projection)
    // TiltX compresses the Y axis (ring tilting toward/away from viewer)
    // TiltY compresses the X axis (ring tilting left/right)
    y *= 1 - config.tiltX * 0.8;
    x *= 1 - config.tiltY * 0.3;

    // Apply rotation
    const rotatedX = x * cosRotation - y * sinRotation;
    const rotatedY = x * sinRotation + y * cosRotation;

    const finalX = centerX + rotatedX;
    const finalY = centerY + rotatedY;

    if (i === 0) {
      path.moveTo(finalX, finalY);
    } else {
      path.lineTo(finalX, finalY);
    }
  }

  path.close();
  return path;
}

export const Orb: React.FC<OrbProps> = ({ size = 120, color = '#10B981' }) => {
  // Shared value for animation time
  const time = useSharedValue(0);

  // Update time every frame
  useFrameCallback((frameInfo) => {
    if (frameInfo.timeSincePreviousFrame !== null) {
      time.value += frameInfo.timeSincePreviousFrame / 1000; // Convert to seconds
    }
  });

  // Ring configurations - each ring has different characteristics
  const ringConfigs = useMemo<RingConfig[]>(
    () => [
      {
        // Ring 1 - Largest, slow rotation, gentle waves
        radiusX: size * 0.45,
        radiusY: size * 0.45,
        rotationSpeed: 0.3,
        rotationOffset: 0,
        tiltX: 0.3,
        tiltY: 0.1,
        waves: [
          { frequency: 3, amplitude: size * 0.03, speed: 1.2, phase: 0 },
          { frequency: 5, amplitude: size * 0.02, speed: 1.8, phase: Math.PI / 3 },
          { frequency: 7, amplitude: size * 0.01, speed: 2.5, phase: Math.PI / 2 },
        ],
      },
      {
        // Ring 2 - Medium, opposite rotation, more chaotic
        radiusX: size * 0.38,
        radiusY: size * 0.35,
        rotationSpeed: -0.45,
        rotationOffset: Math.PI / 3,
        tiltX: 0.5,
        tiltY: 0.2,
        waves: [
          { frequency: 4, amplitude: size * 0.035, speed: 1.5, phase: Math.PI / 4 },
          { frequency: 6, amplitude: size * 0.02, speed: 2.2, phase: 0 },
          { frequency: 9, amplitude: size * 0.01, speed: 3.0, phase: Math.PI },
        ],
      },
      {
        // Ring 3 - Smallest, fast rotation, tight waves
        radiusX: size * 0.32,
        radiusY: size * 0.28,
        rotationSpeed: 0.6,
        rotationOffset: (Math.PI * 2) / 3,
        tiltX: 0.7,
        tiltY: 0.15,
        waves: [
          { frequency: 5, amplitude: size * 0.025, speed: 2.0, phase: Math.PI / 6 },
          { frequency: 8, amplitude: size * 0.015, speed: 2.8, phase: Math.PI / 2 },
          { frequency: 11, amplitude: size * 0.008, speed: 3.5, phase: 0 },
        ],
      },
    ],
    [size]
  );

  const centerX = size / 2;
  const centerY = size / 2;

  // Create animated paths for each ring using useDerivedValue
  const ring1Path = useDerivedValue(() => {
    return generateRingPath(centerX, centerY, ringConfigs[0], time.value);
  }, [time, centerX, centerY, ringConfigs]);

  const ring2Path = useDerivedValue(() => {
    return generateRingPath(centerX, centerY, ringConfigs[1], time.value);
  }, [time, centerX, centerY, ringConfigs]);

  const ring3Path = useDerivedValue(() => {
    return generateRingPath(centerX, centerY, ringConfigs[2], time.value);
  }, [time, centerX, centerY, ringConfigs]);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Canvas style={{ width: size, height: size }}>
        {/* Ring 1 */}
        <Path
          path={ring1Path}
          color={color}
          style="stroke"
          strokeWidth={2}
          strokeCap="round"
          strokeJoin="round"
        />
        {/* Ring 2 */}
        <Path
          path={ring2Path}
          color={color}
          style="stroke"
          strokeWidth={2}
          strokeCap="round"
          strokeJoin="round"
          opacity={0.8}
        />
        {/* Ring 3 */}
        <Path
          path={ring3Path}
          color={color}
          style="stroke"
          strokeWidth={2}
          strokeCap="round"
          strokeJoin="round"
          opacity={0.6}
        />
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
