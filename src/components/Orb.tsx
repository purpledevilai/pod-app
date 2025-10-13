import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';

interface OrbProps {
  volume: number; // 0-1, acts as force vector for animations
  size?: number;
}

const { width: screenWidth } = Dimensions.get('window');

export const Orb: React.FC<OrbProps> = ({ volume, size = 120 }) => {
  // Animation values for each ring
  const ring1Rotation = useRef(new Animated.Value(0)).current;
  const ring1Scale = useRef(new Animated.Value(1)).current;
  const ring1Opacity = useRef(new Animated.Value(0.6)).current;
  
  const ring2Rotation = useRef(new Animated.Value(0)).current;
  const ring2Scale = useRef(new Animated.Value(1)).current;
  const ring2Opacity = useRef(new Animated.Value(0.4)).current;
  
  const ring3Rotation = useRef(new Animated.Value(0)).current;
  const ring3Scale = useRef(new Animated.Value(1)).current;
  const ring3Opacity = useRef(new Animated.Value(0.3)).current;

  // Base animation speeds (when volume = 0)
  const baseSpeeds = {
    rotation: [0.5, 0.3, 0.7], // rotations per second for each ring
    scale: [0.2, 0.15, 0.25], // scale variation speed
    opacity: [0.1, 0.08, 0.12], // opacity variation speed
  };

  // Volume multipliers (how much volume affects each animation)
  const volumeMultipliers = {
    rotation: [2.5, 2.0, 3.0], // how much volume accelerates rotation
    scale: [1.5, 1.2, 1.8], // how much volume affects scale variation
    opacity: [1.0, 0.8, 1.2], // how much volume affects opacity variation
  };

  useEffect(() => {
    const createContinuousAnimation = (
      animatedValue: Animated.Value,
      baseSpeed: number,
      volumeMultiplier: number,
      range: [number, number] = [0, 1]
    ) => {
      const animate = () => {
        const currentSpeed = baseSpeed + (volume * volumeMultiplier);
        const duration = 1000 / currentSpeed; // Convert to duration
        const toValue = range[1];
        
        Animated.timing(animatedValue, {
          toValue,
          duration,
          useNativeDriver: true,
        }).start(() => {
          animatedValue.setValue(range[0]);
          animate();
        });
      };
      animate();
    };

    // Start continuous animations for each ring
    // Ring 1 - Fast, responsive
    createContinuousAnimation(ring1Rotation, baseSpeeds.rotation[0], volumeMultipliers.rotation[0], [0, 360]);
    createContinuousAnimation(ring1Scale, baseSpeeds.scale[0], volumeMultipliers.scale[0], [0.8, 1.2]);
    createContinuousAnimation(ring1Opacity, baseSpeeds.opacity[0], volumeMultipliers.opacity[0], [0.3, 0.8]);

    // Ring 2 - Medium speed
    createContinuousAnimation(ring2Rotation, baseSpeeds.rotation[1], volumeMultipliers.rotation[1], [0, -360]);
    createContinuousAnimation(ring2Scale, baseSpeeds.scale[1], volumeMultipliers.scale[1], [0.7, 1.3]);
    createContinuousAnimation(ring2Opacity, baseSpeeds.opacity[1], volumeMultipliers.opacity[1], [0.2, 0.6]);

    // Ring 3 - Slow, subtle
    createContinuousAnimation(ring3Rotation, baseSpeeds.rotation[2], volumeMultipliers.rotation[2], [0, 180]);
    createContinuousAnimation(ring3Scale, baseSpeeds.scale[2], volumeMultipliers.scale[2], [0.6, 1.4]);
    createContinuousAnimation(ring3Opacity, baseSpeeds.opacity[2], volumeMultipliers.opacity[2], [0.1, 0.5]);

  }, [volume, ring1Rotation, ring1Scale, ring1Opacity, ring2Rotation, ring2Scale, ring2Opacity, ring3Rotation, ring3Scale, ring3Opacity]);

  const ringStyle = (rotation: Animated.Value, scale: Animated.Value, opacity: Animated.Value, dimensions: { width: number; height: number }) => ({
    position: 'absolute' as const,
    width: dimensions.width,
    height: dimensions.height,
    borderRadius: Math.max(dimensions.width, dimensions.height) / 2,
    borderWidth: 2,
    borderColor: '#10B981', // Green color
    transform: [
      { rotate: rotation.interpolate({
        inputRange: [0, 360],
        outputRange: ['0deg', '360deg'],
      }) },
      { scale },
    ],
    opacity,
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Ring 1 - Largest, most prominent */}
      <Animated.View
        style={[
          ringStyle(ring1Rotation, ring1Scale, ring1Opacity, { width: size, height: size }),
          styles.ring1,
        ]}
      />
      
      {/* Ring 2 - Medium */}
      <Animated.View
        style={[
          ringStyle(ring2Rotation, ring2Scale, ring2Opacity, { width: size * 0.8, height: size * 0.6 }),
          styles.ring2,
        ]}
      />
      
      {/* Ring 3 - Smallest, most subtle */}
      <Animated.View
        style={[
          ringStyle(ring3Rotation, ring3Scale, ring3Opacity, { width: size * 0.6, height: size * 0.4 }),
          styles.ring3,
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  ring1: {
    // Base styles for ring 1
  },
  ring2: {
    // Base styles for ring 2
  },
  ring3: {
    // Base styles for ring 3
  },
});
