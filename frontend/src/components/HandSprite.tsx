import type { Hand } from '../game/judge';

interface HandSpriteProps {
  readonly hand: Hand;
  readonly size?: number;
  readonly label?: string;
  readonly className?: string;
  readonly decorative?: boolean;
}

const PIXELS: Readonly<Record<Hand, readonly string[]>> = {
  rock: [
    '0000000000000000',
    '0000011111000000',
    '0000111111100000',
    '0001111111110000',
    '0011111111111000',
    '0011111111111000',
    '0111111111111100',
    '0111111111111100',
    '0111111111111100',
    '0111111111111100',
    '0011111111111000',
    '0011111111111000',
    '0001111111110000',
    '0000111111100000',
    '0000011111000000',
    '0000000000000000',
  ],
  scissors: [
    '0001100000110000',
    '0011100001110000',
    '0011100011100000',
    '0001110111000000',
    '0000111110000000',
    '0000011100000000',
    '0000111110000000',
    '0001111111000000',
    '0011111111100000',
    '0111111111110000',
    '0111111111110000',
    '0011111111100000',
    '0001111111000000',
    '0000111110000000',
    '0000011100000000',
    '0000000000000000',
  ],
  paper: [
    '0000010101000000',
    '0000111111100000',
    '0001111111110000',
    '0011111111111000',
    '0111111111111100',
    '1111111111111110',
    '1111111111111110',
    '1111111111111110',
    '1111111111111110',
    '0111111111111100',
    '0011111111111000',
    '0001111111110000',
    '0001111111110000',
    '0000111111100000',
    '0000011111000000',
    '0000000000000000',
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
  const pixels = PIXELS[hand];

  return (
    <svg
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : label}
      className={`hand-sprite ${className}`.trim()}
      data-hand={hand}
      height={size}
      role={decorative ? undefined : 'img'}
      shapeRendering="crispEdges"
      viewBox="0 0 16 16"
      width={size}
    >
      {!decorative && <title>{label}</title>}
      <g className="hand-sprite__shadow" transform="translate(1 1)">
        {renderPixels(pixels)}
      </g>
      <g className="hand-sprite__pixels">{renderPixels(pixels)}</g>
      <path
        className="hand-sprite__shine"
        d="M5 3h5v1H5zM3 5h2v4H3z"
      />
    </svg>
  );
}

function renderPixels(rows: readonly string[]) {
  return rows.flatMap((row, y) =>
    Array.from(row).flatMap((pixel, x) =>
      pixel === '1' ? <rect key={`${x}-${y}`} height="1" width="1" x={x} y={y} /> : [],
    ),
  );
}
