interface BandPoint {
  x: number;
  y: number;
}

const seededRandom = (seed: number): (() => number) => {
  let state = Math.max(1, Math.floor(seed)) >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
};

export const createRoughBandPoints = (
  width: number,
  height: number,
  roughness: number,
  seed: number,
): BandPoint[] => {
  const random = seededRandom(seed);
  const clampedRoughness = Math.min(1, Math.max(0, roughness));
  const verticalJitter = Math.max(2, Math.min(18, height * 0.1) * clampedRoughness);
  const edgeJitter = Math.max(4, Math.min(28, width * 0.025) * clampedRoughness);
  const jitter = (amount: number): number => (random() - 0.5) * 2 * amount;

  return [
    { x: edgeJitter * 0.45 + jitter(edgeJitter), y: verticalJitter + jitter(verticalJitter) },
    { x: width * 0.18, y: jitter(verticalJitter) },
    { x: width * 0.42, y: verticalJitter * 0.45 + jitter(verticalJitter) },
    { x: width * 0.68, y: jitter(verticalJitter) },
    { x: width * 0.89, y: verticalJitter * 0.3 + jitter(verticalJitter) },
    { x: width + jitter(edgeJitter), y: verticalJitter * 0.9 + jitter(verticalJitter) },
    { x: width - edgeJitter * 0.25 + jitter(edgeJitter), y: height * 0.34 + jitter(verticalJitter) },
    { x: width + jitter(edgeJitter), y: height * 0.66 + jitter(verticalJitter) },
    { x: width - edgeJitter * 0.35 + jitter(edgeJitter), y: height - verticalJitter + jitter(verticalJitter) },
    { x: width * 0.79, y: height + jitter(verticalJitter) },
    { x: width * 0.52, y: height - verticalJitter * 0.25 + jitter(verticalJitter) },
    { x: width * 0.27, y: height + jitter(verticalJitter) },
    { x: edgeJitter * 0.5 + jitter(edgeJitter), y: height - verticalJitter * 0.65 + jitter(verticalJitter) },
    { x: jitter(edgeJitter), y: height * 0.68 + jitter(verticalJitter) },
    { x: edgeJitter * 0.2 + jitter(edgeJitter), y: height * 0.36 + jitter(verticalJitter) },
  ];
};
