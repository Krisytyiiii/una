import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, fontSize, glass } from '@/theme';

const TINTS = [colors.blue, colors.blueDark, colors.ink, colors.muted] as const;

type Props = {
  name: string;
  size?: number;
  /** White halo used over a coloured surface. */
  ring?: boolean;
  /** Sun dot in the corner — "this thread has something new". */
  dot?: boolean;
  /** Forces one tint (e.g. the featured session card's counselor). */
  tone?: string;
};

/** "Dr. Maria Santos" -> "MS"; "Guidance Office" -> "GO". */
function initialsOf(name: string): string {
  const words = name
    .replace(/\b(dr|mr|mrs|ms|miss|prof)\.?\b/gi, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

/** Stable tint per name so a counselor keeps the same colour everywhere. */
function tintFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return TINTS[hash % TINTS.length];
}

/**
 * Initials avatar for counselors and other contacts. Photos don't exist for
 * counselors in the student API, so a deterministic monogram keeps cards
 * scannable without inventing people.
 */
export function InitialsAvatar({ name, size = 48, ring, dot, tone }: Props) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: tone ?? tintFor(name),
        },
        ring && styles.ring,
      ]}
    >
      <Text
        style={[styles.initials, { fontSize: size >= 44 ? fontSize.md : fontSize.xs }]}
      >
        {initialsOf(name)}
      </Text>
      {dot ? <View style={styles.dot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    borderWidth: 2,
    borderColor: glass.border,
  },
  initials: {
    fontFamily: fontFamily.bold,
    color: colors.white,
    letterSpacing: 0.4,
  },
  dot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.sun,
    borderWidth: 2,
    borderColor: colors.white,
  },
});
