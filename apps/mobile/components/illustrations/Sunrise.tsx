import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { colors } from '@/theme';

type Props = {
  width?: number;
  height?: number;
  sky?: string;
  hillFar?: string;
  hillNear?: string;
  /** Vertical sun position as a fraction of height (0 = top). */
  sunY?: number;
};

// Onboarding sunrise: sky panel, yellow sun + halo, white clouds, fading hills.
// Pass sky/hill colors per page; all defaults come from the theme. Raising
// `sunY` page by page turns the carousel into a slow sunrise.
export function Sunrise({
  width = 360,
  height = 480,
  sky = colors.sky,
  hillFar = colors.blue,
  hillNear = colors.ink,
  sunY = 0.42,
}: Props) {
  const sunCy = height * sunY;
  // Scale the disc with the panel so the short onboarding hero doesn't get a
  // sun that swallows the whole frame.
  const sunR = Math.min(64, height * 0.26);
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Path d={`M0 0 H${width} V${height} H0 Z`} fill={sky} />
      <Circle cx={width / 2} cy={sunCy} r={sunR * 1.5} fill={colors.sun} opacity={0.25} />
      <Circle cx={width / 2} cy={sunCy} r={sunR} fill={colors.sun} />
      <Ellipse cx={width * 0.22} cy={height * 0.28} rx={44} ry={16} fill={colors.white} />
      <Ellipse cx={width * 0.34} cy={height * 0.24} rx={30} ry={12} fill={colors.white} />
      <Ellipse cx={width * 0.78} cy={height * 0.32} rx={40} ry={14} fill={colors.white} />
      <Path
        d={`M0 ${height * 0.72} Q ${width * 0.25} ${height * 0.58} ${width * 0.55} ${height * 0.72} T ${width} ${height * 0.7} V${height} H0 Z`}
        fill={hillFar}
        opacity={0.55}
      />
      <Path
        d={`M0 ${height * 0.82} Q ${width * 0.3} ${height * 0.68} ${width * 0.6} ${height * 0.82} T ${width} ${height * 0.8} V${height} H0 Z`}
        fill={hillNear}
      />
    </Svg>
  );
}
