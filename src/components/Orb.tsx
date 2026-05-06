import { useTheme } from '@/src/providers/ThemeProvider';
import {
  BlurMask,
  Canvas,
  Circle,
  ColorMatrix,
  Group,
  RadialGradient,
  Turbulence,
  vec,
} from '@shopify/react-native-skia';
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

interface OrbProps {
  size?: number;
  /**
   * Base color. The orb derives a full gradient + cloud palette from this
   * (lightened tints for highlights, darkened shades for depth).
   * Defaults to the theme primary.
   */
  color?: string;
  /**
   * Audio level from the user's microphone (0-1). Currently ignored — the
   * orb only reacts to the agent's voice — but kept on the API for
   * backwards compatibility with existing call sites.
   */
  userAudioLevel?: number;
  /** Audio level from the AI/agent (0-1) */
  aiAudioLevel?: number;
}

// --- color helpers --------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  let cleaned = hex.replace('#', '');
  if (cleaned.length === 3) {
    cleaned = cleaned
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return [r, g, b];
}

function rgbToHsl(
  r: number,
  g: number,
  b: number
): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h * 360, s, l];
}

function hslToHex(h: number, s: number, l: number, alpha?: number): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(1, s));
  const ll = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const hp = hh / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp < 1) {
    r1 = c;
    g1 = x;
  } else if (hp < 2) {
    r1 = x;
    g1 = c;
  } else if (hp < 3) {
    g1 = c;
    b1 = x;
  } else if (hp < 4) {
    g1 = x;
    b1 = c;
  } else if (hp < 5) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }
  const m = ll - c / 2;
  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  if (alpha !== undefined) {
    const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(a)}`;
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

interface OrbPalette {
  highlight: string; // near-white tint (top of base gradient)
  light: string; // light tint
  mid: string; // the input color (or close to it)
  dark: string; // darker shade
  deep: string; // deepest shade at the orb's far edge
  cloudTint: string; // tint applied to the cloud noise (lightest tint)
}

function buildPalette(color: string): OrbPalette {
  const [r, g, b] = hexToRgb(color);
  const [h, s] = rgbToHsl(r, g, b);
  // Normalize saturation so very dull colors still produce a visible gradient.
  const sat = Math.max(0.45, s);
  return {
    highlight: hslToHex(h, Math.min(0.4, sat * 0.6), 0.96),
    light: hslToHex(h, sat * 0.85, 0.82),
    mid: hslToHex(h, sat, 0.55),
    dark: hslToHex(h, sat, 0.32),
    deep: hslToHex(h, sat * 0.9, 0.12),
    cloudTint: hslToHex(h, Math.min(0.35, sat * 0.5), 0.95),
  };
}

// --- component ------------------------------------------------------------

export const Orb: React.FC<OrbProps> = ({
  size = 120,
  color,
  aiAudioLevel = 0,
}) => {
  const theme = useTheme();
  const baseColor = color ?? theme.colors.primary;

  const palette = useMemo(() => buildPalette(baseColor), [baseColor]);

  // Convert the cloud tint's RGB into the ColorMatrix "add" channels so the
  // turbulence noise is colored toward the palette's lightest tone instead of
  // pure white.
  const cloudMatrix = useMemo(() => {
    const [cr, cg, cb] = hexToRgb(palette.cloudTint);
    const rN = cr / 255;
    const gN = cg / 255;
    const bN = cb / 255;
    return {
      primary: [
        0, 0, 0, 0, rN,
        0, 0, 0, 0, gN,
        0, 0, 0, 0, bN,
        0.7, 0.7, 0.7, 0, -0.55,
      ],
      secondary: [
        0, 0, 0, 0, rN,
        0, 0, 0, 0, gN,
        0, 0, 0, 0, bN,
        0.8, 0.8, 0.8, 0, -0.65,
      ],
    };
  }, [palette.cloudTint]);

  const time = useSharedValue(0);
  const smoothAiLevel = useSharedValue(0);

  useEffect(() => {
    smoothAiLevel.value = withSpring(aiAudioLevel, {
      damping: 15,
      stiffness: 150,
      mass: 0.5,
    });
  }, [aiAudioLevel, smoothAiLevel]);

  useFrameCallback((frameInfo) => {
    if (frameInfo.timeSincePreviousFrame === null) return;
    const dt = frameInfo.timeSincePreviousFrame / 1000;
    time.value += dt;
  });

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.4;

  const orbTransform = useDerivedValue(() => {
    const scale = 1 + smoothAiLevel.value * 0.08;
    return [{ scale }];
  });

  const cloudTransform = useDerivedValue(() => {
    const audioBoost = 1 + smoothAiLevel.value * 4;
    return [{ rotate: time.value * 0.12 * audioBoost }];
  });

  const cloudTransformAlt = useDerivedValue(() => {
    const audioBoost = 1 + smoothAiLevel.value * 3;
    return [{ rotate: -time.value * 0.08 * audioBoost }];
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Canvas style={{ width: size, height: size }}>
        <Group origin={vec(cx, cy)} transform={orbTransform}>
          {/* Base spherical gradient: light highlight to deep rim */}
          <Circle cx={cx} cy={cy} r={radius}>
            <RadialGradient
              c={vec(cx - radius * 0.25, cy - radius * 0.35)}
              r={radius * 1.5}
              colors={[
                palette.highlight,
                palette.light,
                palette.mid,
                palette.dark,
                palette.deep,
              ]}
              positions={[0, 0.18, 0.55, 0.9, 1]}
            />
          </Circle>

          {/* Cloud overlay drifting slowly across the orb. */}
          <Group origin={vec(cx, cy)} transform={cloudTransform}>
            <Circle cx={cx} cy={cy} r={radius} opacity={0.55}>
              <Turbulence freqX={0.018} freqY={0.018} octaves={4} seed={3} />
              <ColorMatrix matrix={cloudMatrix.primary} />
            </Circle>
          </Group>

          {/* Finer counter-rotating cloud layer for depth. */}
          <Group origin={vec(cx, cy)} transform={cloudTransformAlt}>
            <Circle cx={cx} cy={cy} r={radius} opacity={0.3}>
              <Turbulence freqX={0.04} freqY={0.04} octaves={3} seed={11} />
              <ColorMatrix matrix={cloudMatrix.secondary} />
            </Circle>
          </Group>

          {/* Specular-style highlight to sell the spherical look */}
          <Circle
            cx={cx - radius * 0.3}
            cy={cy - radius * 0.4}
            r={radius * 0.35}
            opacity={0.55}
          >
            <RadialGradient
              c={vec(cx - radius * 0.3, cy - radius * 0.4)}
              r={radius * 0.35}
              colors={['#ffffffDD', '#ffffff00']}
            />
            <BlurMask blur={6} style="normal" />
          </Circle>

        </Group>
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
