import { useMemo } from 'react';
import * as THREE from 'three';

// NACA 16-series-style section (default). 16% thick, mild camber.
function naca16Points(chord: number, n: number): THREE.Vector2[] {
  const upper: THREE.Vector2[] = [];
  const lower: THREE.Vector2[] = [];
  const t = 0.16;
  const m = 0.02;
  const p = 0.4;
  for (let i = 0; i <= n; i++) {
    const xc = i / n;
    const yt =
      5 * t *
      (0.2969 * Math.sqrt(xc) -
        0.1260 * xc -
        0.3516 * xc ** 2 +
        0.2843 * xc ** 3 -
        0.1015 * xc ** 4);
    const yc =
      xc <= p
        ? (m / (p * p)) * (2 * p * xc - xc * xc)
        : (m / ((1 - p) * (1 - p))) * ((1 - 2 * p) + 2 * p * xc - xc * xc);
    upper.push(new THREE.Vector2(xc * chord, (yc + yt / 2) * chord));
    lower.push(new THREE.Vector2(xc * chord, (yc - yt / 2) * chord));
  }
  return [...upper, ...lower.reverse()];
}

// Standard NACA 4-digit: MPPT where M=max camber%, P=position in tenths, TT=thickness%
function naca4Points(code: string, chord: number, n: number): THREE.Vector2[] {
  const m = parseInt(code[0], 10) / 100;
  const p = parseInt(code[1], 10) / 10;
  const t = parseInt(code.slice(2), 10) / 100;

  const upper: THREE.Vector2[] = [];
  const lower: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) {
    const xc = i / n;
    const yt =
      5 * t *
      (0.2969 * Math.sqrt(xc) -
        0.1260 * xc -
        0.3516 * xc ** 2 +
        0.2843 * xc ** 3 -
        0.1015 * xc ** 4);

    let yc = 0;
    if (m > 0 && p > 0 && p < 1) {
      if (xc <= p) {
        yc = (m / (p * p)) * (2 * p * xc - xc * xc);
      } else {
        yc = (m / ((1 - p) ** 2)) * ((1 - 2 * p) + 2 * p * xc - xc * xc);
      }
    }

    upper.push(new THREE.Vector2(xc * chord, (yc + yt) * chord));
    lower.push(new THREE.Vector2(xc * chord, (yc - yt) * chord));
  }
  return [...upper, ...lower.reverse()];
}

interface Props {
  code?: string;
}

export function Airfoil({ code }: Props) {
  const geometry = useMemo(() => {
    const points = code && /^\d{4}$/.test(code)
      ? naca4Points(code, 2, 120)
      : naca16Points(2, 120);
    const shape = new THREE.Shape(points);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 1.2,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.015,
      bevelThickness: 0.015,
      steps: 1,
    });
    geo.center();
    return geo;
  }, [code]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#00A8E8" metalness={0.6} roughness={0.3} />
    </mesh>
  );
}
