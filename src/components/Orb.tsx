import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface OrbProps {
  size?: number;
}

export const Orb: React.FC<OrbProps> = ({ size = 120 }) => {
  // Simple rotation animations for each ellipse
  const ring1Rotation = useRef(new Animated.Value(0)).current;
  const ring2Rotation = useRef(new Animated.Value(0)).current;
  const ring3Rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Create continuous rotation animations
    const createRotation = (animatedValue: Animated.Value, duration: number) => {
      const rotate = () => {
        animatedValue.setValue(0);
        Animated.timing(animatedValue, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }).start(() => rotate());
      };
      rotate();
    };

    // Start rotations at different speeds
    createRotation(ring1Rotation, 3000); // 3 seconds per rotation
    createRotation(ring2Rotation, 4000); // 4 seconds per rotation (opposite direction)
    createRotation(ring3Rotation, 5000); // 5 seconds per rotation
  }, [ring1Rotation, ring2Rotation, ring3Rotation]);

  const ringStyle = (rotation: Animated.Value, dimensions: { width: number; height: number }) => ({
    position: 'absolute' as const,
    width: dimensions.width,
    height: dimensions.height,
    borderRadius: Math.max(dimensions.width, dimensions.height) / 2,
    borderWidth: 2,
    borderColor: '#10B981', // Green color
    transform: [
      { 
        rotate: rotation.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        }) 
      },
    ],
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Ring 1 - Largest */}
      <Animated.View
        style={[
          ringStyle(ring1Rotation, { width: size, height: size }),
          styles.ring1,
        ]}
      />
      
      {/* Ring 2 - Medium */}
      <Animated.View
        style={[
          ringStyle(ring2Rotation, { width: size * 0.8, height: size * 0.6 }),
          styles.ring2,
        ]}
      />
      
      {/* Ring 3 - Smallest */}
      <Animated.View
        style={[
          ringStyle(ring3Rotation, { width: size * 0.6, height: size * 0.4 }),
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
