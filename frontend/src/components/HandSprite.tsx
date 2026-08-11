import type { Hand } from '../game/judge';

interface HandSpriteProps {
  readonly hand: Hand;
  readonly size?: number;
  readonly label?: string;
  readonly className?: string;
  readonly decorative?: boolean;
}

type LedPoint = readonly [x: number, y: number];
type LedPath = readonly LedPoint[];

const LED_PATHS: Readonly<Record<Hand, readonly LedPath[]>> = {
  rock: [
    [
      [8, 20.5], [6.5, 19], [5, 18], [6, 15.8], [2.5, 14.8], [1, 12],
      [1.8, 9.2], [4.2, 7.8], [4.2, 5.2], [6.2, 3.8], [8.5, 5],
      [11, 3.8], [13.8, 4.2], [15.8, 5.8], [18.5, 5.8], [20.2, 7.8],
      [22.2, 9], [23, 11.8], [22, 14.2], [19.8, 16], [17.8, 18], [17, 20.2],
      [16, 20.8], [15, 20.3], [14, 21.2], [13, 20.5], [12, 21.3],
      [11, 20.5], [10, 21.2], [9, 20.3], [8, 20.5],
    ],
    [[8.8, 8.2], [9.2, 11], [9.8, 13.5]],
    [[13.8, 8.2], [13.5, 11], [13.5, 13.5]],
    [[6, 15.5], [7.2, 18], [17, 18], [18.2, 16]],
  ],
  scissors: [
    [
      [9.1, 22.6], [7.2, 20.8], [5.1, 19.1], [3.6, 16.4], [2.9, 13.6],
      [3.8, 10.6], [4.5, 8.9], [4.4, 5.1], [5.3, 1.3], [6.1, 0.7],
      [7, 1.9], [7.8, 4.9], [9.2, 7.4], [9.9, 8], [10.7, 7.4],
      [11.7, 4.4], [12.3, 1.4], [13.5, 0.7], [14.3, 1.9], [14, 5.4],
      [13.9, 8.4], [16, 7.2], [17.5, 7.7], [17.6, 9.6], [20, 10.6],
      [21.4, 12.4], [21.4, 14.8], [20.4, 17.5], [18.4, 19.6], [15.7, 21],
      [15.4, 22], [9.1, 22.6],
    ],
    [[9.3, 11.3], [9.5, 14], [9.6, 16.6]],
    [[12.6, 11], [12.8, 14], [12.6, 16.3]],
    [[9.1, 21], [15.7, 21]],
  ],
  paper: [
    [
      [8, 20], [6.5, 19.5], [5, 18.5], [3.5, 18], [3.5, 17], [2, 16.5],
      [2.5, 15.5], [1, 15], [1, 13.5], [2, 12.5], [3.5, 12.5], [5.5, 13.5],
      [5, 10], [4.5, 6], [5, 3.5], [6, 2.2], [7.2, 2.5], [8, 4], [8, 8],
      [9, 3], [9.6, 1], [10.8, 0.7], [12, 1.7], [11.7, 7.5],
      [13, 4], [14, 2.5], [15.2, 2.8], [16, 4.5], [15.2, 9],
      [17, 6], [18.2, 4.8], [19.4, 5.3], [20, 7], [18.5, 12],
      [20, 10.5], [22, 9.5], [23, 10.5], [22.5, 13.5], [21, 16],
      [19, 18], [17, 19.5], [16, 20.5], [16.5, 21.5], [15.5, 21.3],
      [15, 22.3], [14, 21.6], [13, 22.5], [12, 21.7], [11, 22.5],
      [10, 21.5], [8.8, 22], [8, 20],
    ],
    [[9, 10], [9.2, 13], [9, 16]],
    [[13, 10], [12.8, 13], [13, 16]],
  ],
};

const HAND_NAMES: Readonly<Record<Hand, string>> = {
  rock: 'グー',
  scissors: 'チョキ',
  paper: 'パー',
};

export function HandSprite({
  hand,
  size = 128,
  label = HAND_NAMES[hand],
  className = '',
  decorative = false,
}: HandSpriteProps) {
  const ledPaths = LED_PATHS[hand];

  return (
    <svg
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : label}
      className={`hand-sprite ${className}`.trim()}
      data-hand={hand}
      height={size}
      role={decorative ? undefined : 'img'}
      shapeRendering="crispEdges"
      viewBox="0 0 24 24"
      width={size}
    >
      {!decorative && <title>{label}</title>}
      <g className="hand-sprite__shadow" transform="translate(1 1)">
        {renderLedPaths(ledPaths)}
      </g>
      <g className="hand-sprite__pixels">{renderLedPaths(ledPaths)}</g>
    </svg>
  );
}

function renderLedPaths(paths: readonly LedPath[]) {
  return paths.flatMap((path, pathIndex) =>
    path.slice(0, -1).flatMap(([startX, startY], segmentIndex) => {
      const [endX, endY] = path[segmentIndex + 1] ?? [startX, startY];
      const distance = Math.hypot(endX - startX, endY - startY);
      const steps = Math.max(1, Math.round(distance / 0.86));
      return Array.from({ length: steps }, (_, step) => {
        const progress = step / steps;
        const x = startX + (endX - startX) * progress;
        const y = startY + (endY - startY) * progress;
        return (
          <rect
            height="0.68"
            key={`${pathIndex}-${segmentIndex}-${step}`}
            rx="0.32"
            width="0.68"
            x={x - 0.34}
            y={y - 0.34}
          />
        );
      });
    }),
  );
}
