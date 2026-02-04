import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  SharedValue,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

interface OrbProps {
  size?: number;
  color?: string;
  /** Audio level from the user's microphone (0-1) */
  userAudioLevel?: number;
  /** Audio level from the AI/agent (0-1) */
  aiAudioLevel?: number;
}

interface RingConfig {
  // Ellipse shape
  radiusX: number;
  radiusY: number;
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

interface RingPhysics {
  // Direction: 1 = clockwise, -1 = counter-clockwise
  direction: number;
  // Base velocity when idle (radians/sec)
  baseVelocity: number;
  // Max velocity cap (radians/sec)
  maxVelocity: number;
  // Friction coefficient (0-1, higher = more friction, slows faster)
  friction: number;
  // How much audio accelerates this ring (radians/sec per audio unit)
  audioAcceleration: number;
  // Initial rotation offset
  initialRotation: number;
  // Audio mix: [aiWeight, userWeight] - how much each audio source affects this ring
  audioMix: [number, number];
}

const NUM_POINTS = 80; // Number of points to draw each ring (more = smoother)

/**
 * Generate a deformed ellipse path using sine wave superposition
 * @param rotation - Current rotation angle in radians (physics-driven)
 * @param time - Animation time for wave movement
 * @param intensity - Multiplier for wave amplitude (1.0 = normal, higher = more intense)
 * @param waveSpeed - Multiplier for wave animation speed (1.0 = normal)
 */
function generateRingPath(
  centerX: number,
  centerY: number,
  config: RingConfig,
  rotation: number,
  time: number,
  intensity: number = 1,
  waveSpeed: number = 1
): ReturnType<typeof Skia.Path.Make> {
  'worklet';
  const path = Skia.Path.Make();

  const cosRotation = Math.cos(rotation);
  const sinRotation = Math.sin(rotation);

  for (let i = 0; i <= NUM_POINTS; i++) {
    const angle = (i / NUM_POINTS) * Math.PI * 2;

    // Calculate wave deformation - sum of multiple sine waves
    // Amplitude is scaled by intensity (audio level)
    let radiusOffset = 0;
    for (const wave of config.waves) {
      radiusOffset +=
        Math.sin(angle * wave.frequency + time * wave.speed * waveSpeed + wave.phase) *
        wave.amplitude * intensity;
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

export const Orb: React.FC<OrbProps> = ({
  size = 120,
  color = '#10B981',
  userAudioLevel = 0,
  aiAudioLevel = 0,
}) => {
  // Shared value for animation time (used for wave animation)
  const time = useSharedValue(0);

  // Smoothed audio levels using spring animation for fluid response
  const smoothUserLevel = useSharedValue(0);
  const smoothAiLevel = useSharedValue(0);

  // Physics state for each ring: rotation (angle) and velocity (angular speed)
  const ring1Rotation = useSharedValue(0);
  const ring1Velocity = useSharedValue(0.3); // Start with base velocity
  const ring2Rotation = useSharedValue(Math.PI / 3);
  const ring2Velocity = useSharedValue(0.4);
  const ring3Rotation = useSharedValue((Math.PI * 2) / 3);
  const ring3Velocity = useSharedValue(0.5);

  // Physics configuration for each ring
  const ringPhysics = useMemo<RingPhysics[]>(
    () => [
      {
        // Ring 1 - Outer ring, slow and heavy, responds more to AI
        direction: 1,
        baseVelocity: 0.3,
        maxVelocity: 4.0,
        friction: 2.0, // Lower = less friction, slower decay
        audioAcceleration: 8.0,
        initialRotation: 0,
        audioMix: [0.7, 0.3], // [AI weight, User weight]
      },
      {
        // Ring 2 - Middle ring, medium speed, opposite direction, balanced response
        direction: -1,
        baseVelocity: 0.4,
        maxVelocity: 5.0,
        friction: 2.5,
        audioAcceleration: 10.0,
        initialRotation: Math.PI / 3,
        audioMix: [0.5, 0.5],
      },
      {
        // Ring 3 - Inner ring, faster and lighter, responds more to user
        direction: 1,
        baseVelocity: 0.5,
        maxVelocity: 6.0,
        friction: 3.0, // Higher friction = snappier response
        audioAcceleration: 12.0,
        initialRotation: (Math.PI * 2) / 3,
        audioMix: [0.3, 0.7],
      },
    ],
    []
  );

  // Update smoothed audio levels when props change
  useEffect(() => {
    smoothUserLevel.value = withSpring(userAudioLevel, {
      damping: 15,
      stiffness: 150,
      mass: 0.5,
    });
  }, [userAudioLevel, smoothUserLevel]);

  useEffect(() => {
    smoothAiLevel.value = withSpring(aiAudioLevel, {
      damping: 15,
      stiffness: 150,
      mass: 0.5,
    });
  }, [aiAudioLevel, smoothAiLevel]);

  // Physics simulation runs every frame
  useFrameCallback((frameInfo) => {
    if (frameInfo.timeSincePreviousFrame === null) return;

    const dt = frameInfo.timeSincePreviousFrame / 1000; // Delta time in seconds
    time.value += dt;

    // Helper function to update ring physics
    const updateRingPhysics = (
      rotation: SharedValue<number>,
      velocity: SharedValue<number>,
      physics: RingPhysics
    ) => {
      'worklet';
      // Calculate combined audio level based on this ring's mix
      const audioLevel =
        smoothAiLevel.value * physics.audioMix[0] +
        smoothUserLevel.value * physics.audioMix[1];

      // Apply friction (exponential decay toward base velocity)
      // velocity approaches baseVelocity over time when no audio
      const targetVelocity = physics.baseVelocity + audioLevel * physics.audioAcceleration;
      
      // Exponential interpolation toward target velocity
      // friction acts as the rate of approach (higher = faster approach)
      const frictionFactor = 1 - Math.exp(-physics.friction * dt);
      velocity.value = velocity.value + (targetVelocity - velocity.value) * frictionFactor;

      // Clamp velocity to max (always positive, direction is separate)
      velocity.value = Math.min(velocity.value, physics.maxVelocity);
      velocity.value = Math.max(velocity.value, physics.baseVelocity * 0.5); // Never go below half base

      // Update rotation based on velocity and direction
      rotation.value += velocity.value * physics.direction * dt;
    };

    // Update physics for each ring
    updateRingPhysics(ring1Rotation, ring1Velocity, ringPhysics[0]);
    updateRingPhysics(ring2Rotation, ring2Velocity, ringPhysics[1]);
    updateRingPhysics(ring3Rotation, ring3Velocity, ringPhysics[2]);
  });

  // Ring visual configurations (shape and waves)
  const ringConfigs = useMemo<RingConfig[]>(
    () => [
      {
        // Ring 1 - Largest, gentle waves
        radiusX: size * 0.45,
        radiusY: size * 0.45,
        tiltX: 0.3,
        tiltY: 0.1,
        waves: [
          { frequency: 3, amplitude: size * 0.03, speed: 1.2, phase: 0 },
          { frequency: 5, amplitude: size * 0.02, speed: 1.8, phase: Math.PI / 3 },
          { frequency: 7, amplitude: size * 0.01, speed: 2.5, phase: Math.PI / 2 },
        ],
      },
      {
        // Ring 2 - Medium, more chaotic waves
        radiusX: size * 0.38,
        radiusY: size * 0.35,
        tiltX: 0.5,
        tiltY: 0.2,
        waves: [
          { frequency: 3, amplitude: size * 0.035, speed: 1.5, phase: Math.PI / 4 },
          { frequency: 5, amplitude: size * 0.02, speed: 2.2, phase: 0 },
          { frequency: 7, amplitude: size * 0.01, speed: 3.0, phase: Math.PI },
        ],
      },
      {
        // Ring 3 - Smallest, tight waves
        radiusX: size * 0.32,
        radiusY: size * 0.28,
        tiltX: 0.7,
        tiltY: 0.15,
        waves: [
          { frequency: 3, amplitude: size * 0.025, speed: 2.0, phase: Math.PI / 6 },
          { frequency: 5, amplitude: size * 0.015, speed: 2.8, phase: Math.PI / 2 },
          { frequency: 7, amplitude: size * 0.008, speed: 3.5, phase: 0 },
        ],
      },
    ],
    [size]
  );

  const centerX = size / 2;
  const centerY = size / 2;

  // Audio intensity settings for wave deformation
  const BASE_INTENSITY = 1.0;
  const AUDIO_INTENSITY_MULTIPLIER = 3.0;
  const WAVE_SPEED_BOOST = 1.5;

  // Create animated paths for each ring
  const ring1Path = useDerivedValue(() => {
    const audioLevel = smoothAiLevel.value * 0.7 + smoothUserLevel.value * 0.3;
    const intensity = BASE_INTENSITY + audioLevel * AUDIO_INTENSITY_MULTIPLIER;
    const waveSpeed = 1 + audioLevel * (WAVE_SPEED_BOOST - 1);
    return generateRingPath(
      centerX, centerY, ringConfigs[0],
      ring1Rotation.value, time.value, intensity, waveSpeed
    );
  }, [ring1Rotation, time, smoothAiLevel, smoothUserLevel]);

  const ring2Path = useDerivedValue(() => {
    const audioLevel = smoothAiLevel.value * 0.5 + smoothUserLevel.value * 0.5;
    const intensity = BASE_INTENSITY + audioLevel * AUDIO_INTENSITY_MULTIPLIER;
    const waveSpeed = 1 + audioLevel * (WAVE_SPEED_BOOST - 1);
    return generateRingPath(
      centerX, centerY, ringConfigs[1],
      ring2Rotation.value, time.value, intensity, waveSpeed
    );
  }, [ring2Rotation, time, smoothAiLevel, smoothUserLevel]);

  const ring3Path = useDerivedValue(() => {
    const audioLevel = smoothAiLevel.value * 0.3 + smoothUserLevel.value * 0.7;
    const intensity = BASE_INTENSITY + audioLevel * AUDIO_INTENSITY_MULTIPLIER;
    const waveSpeed = 1 + audioLevel * (WAVE_SPEED_BOOST - 1);
    return generateRingPath(
      centerX, centerY, ringConfigs[2],
      ring3Rotation.value, time.value, intensity, waveSpeed
    );
  }, [ring3Rotation, time, smoothAiLevel, smoothUserLevel]);

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
    overflow: 'visible',
  },
});
