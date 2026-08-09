import Svg, { Path } from 'react-native-svg';

function pathFromPoints(points) {
  if (!points || points.length === 0) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

export default function PortraitView({ strokes, size }) {
  if (!strokes || !strokes.strokes || strokes.strokes.length === 0) return null;

  const { width, height } = typeof size === 'number' ? { width: size, height: size } : size;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${strokes.w} ${strokes.h}`}>
      {strokes.strokes.map((s, i) => (
        <Path
          key={i}
          d={pathFromPoints(s.points)}
          stroke={s.color}
          strokeWidth={s.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </Svg>
  );
}
