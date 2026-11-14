import type { ReactNode } from "react";
import { texts } from "../logic/data";
import { hohmann } from "../logic/resources";
import type { Destination } from "../logic/types";

interface OrbitMapProps {
  destination: Destination;
  month: number;
  good: boolean;
}

const CENTER = 200;
const EARTH_R = 78;

function point(radius: number, angle: number): { x: number; y: number } {
  return {
    x: CENTER + radius * Math.cos(angle),
    y: CENTER - radius * Math.sin(angle),
  };
}

// Where to put a label: just outside the given radius, on the side away from the Sun.
function labelAt(
  radius: number,
  angle: number,
): { x: number; y: number; anchor: "start" | "middle" | "end" } {
  const p = point(radius, angle);
  const cos = Math.cos(angle);
  let anchor: "start" | "middle" | "end" = "middle";
  if (cos > 0.35) {
    anchor = "start";
  } else if (cos < -0.35) {
    anchor = "end";
  }
  return { x: p.x, y: p.y + 4, anchor };
}

// Earth's angle around the Sun for a month index (0 = Jan 2027).
function earthAngle(month: number): number {
  return Math.PI * 0.75 + (2 * Math.PI * month) / 12;
}

// Top-down map of the inner solar system: where Earth and the target are at launch,
// the transfer path, and where the target will be when the spacecraft arrives.
export function OrbitMap({ destination, month, good }: OrbitMapProps) {
  if (destination.window.alwaysOpen) {
    return <MoonMap />;
  }

  const orbitAU = destination.map.orbitAU;
  const targetR = orbitAU > 3 ? 172 : 128;
  const ideal = hohmann(orbitAU);
  const periodMonths = Math.pow(orbitAU, 1.5) * 12;

  // Target angle is set so that at the best month it leads Earth by the ideal angle.
  const best = destination.window.bestMonth;
  const targetAt = (m: number) =>
    earthAngle(best) +
    ideal.leadAngle +
    (2 * Math.PI * (m - best)) / periodMonths;

  const launchAngle = earthAngle(month);
  const earth = point(EARTH_R, launchAngle);
  const targetNow = point(targetR, targetAt(month));
  const arrivalPoint = point(targetR, launchAngle + Math.PI);
  const targetAtArrival = point(targetR, targetAt(month + ideal.months));

  // Half an ellipse with the Sun at one focus: from Earth (closest) to the target orbit (farthest).
  const a = (EARTH_R + targetR) / 2;
  const e = (targetR - EARTH_R) / (targetR + EARTH_R);
  const transferPoints: string[] = [];
  for (let i = 0; i <= 48; i++) {
    const phi = (Math.PI * i) / 48;
    const r = (a * (1 - e * e)) / (1 - e * Math.cos(phi + Math.PI));
    const p = point(r, launchAngle + phi);
    transferPoints.push(p.x.toFixed(1) + "," + p.y.toFixed(1));
  }

  const accent = good ? "#5dcaa5" : "#ef9f27";
  const t = texts.ui.window;
  const color = destination.map.color;

  // Path of the spacecraft, as an SVG path (used for the line and for the moving dot).
  const transferPath = "M" + transferPoints.join(" L");

  // How far the target moves along its orbit while the spacecraft flies.
  const moveFrom = targetAt(month);
  const moveTo = targetAt(month + ideal.months);
  const movePoints: string[] = [];
  for (let i = 0; i <= 32; i++) {
    const p = point(targetR, moveFrom + ((moveTo - moveFrom) * i) / 32);
    movePoints.push(p.x.toFixed(1) + "," + p.y.toFixed(1));
  }

  // Crop the picture to the orbits, so it fills the panel. The legend lives outside the SVG.
  const margin = targetR + 58;
  const viewBox = [
    CENTER - margin,
    CENTER - margin,
    margin * 2,
    margin * 2,
  ].join(" ");
  const targetLabel = labelAt(targetR + 16, targetAt(month));
  const arrivalLabel = labelAt(targetR + 18, launchAngle + Math.PI);

  const ticks: ReactNode[] = [];
  for (let i = 0; i < 12; i++) {
    const p1 = point(EARTH_R - 4, earthAngle(i));
    const p2 = point(EARTH_R + 4, earthAngle(i));
    ticks.push(
      <line
        key={i}
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke="rgba(255,255,255,0.18)"
      />,
    );
  }

  return (
    <>
      <svg
        className="orbit-map"
        viewBox={viewBox}
        role="img"
        aria-label={t.mapLabel}
      >
        <defs>
          <radialGradient id="sunGlow">
            <stop offset="0%" stopColor="#ffe9b0" />
            <stop offset="35%" stopColor="#ffb648" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ff8a00" stopOpacity="0" />
          </radialGradient>
          <marker
            id="moveArrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path
              d="M0,1 L8,5 L0,9"
              fill="none"
              stroke={color}
              strokeWidth="1.6"
            />
          </marker>
        </defs>

        {/* Sun and orbits */}
        <circle cx={CENTER} cy={CENTER} r="26" fill="url(#sunGlow)" />
        <circle cx={CENTER} cy={CENTER} r="7" fill="#fff2cc" />
        <text
          x={CENTER}
          y={CENTER + 24}
          textAnchor="middle"
          className="map-label map-label-faint"
        >
          {t.sun}
        </text>
        <circle
          cx={CENTER}
          cy={CENTER}
          r={EARTH_R}
          fill="none"
          stroke="rgba(111,183,255,0.35)"
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={targetR}
          fill="none"
          stroke="rgba(255,255,255,0.14)"
          strokeDasharray="2 5"
        />
        {ticks}

        {/* The target keeps moving while we fly: this arc is the lesson of the launch window. */}
        <polyline
          key={"move" + month}
          className="target-move"
          points={movePoints.join(" ")}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeDasharray="1 5"
          strokeLinecap="round"
          markerEnd="url(#moveArrow)"
        />

        {/* Spacecraft path */}
        <path
          key={"path" + month}
          className="transfer-path"
          d={transferPath}
          fill="none"
          stroke={accent}
          strokeWidth="1.8"
        />
        {!good && (
          <line
            x1={arrivalPoint.x}
            y1={arrivalPoint.y}
            x2={targetAtArrival.x}
            y2={targetAtArrival.y}
            stroke="#ef9f27"
            strokeDasharray="3 4"
            strokeWidth="1.2"
          />
        )}
        <circle className="map-craft" r="3.5" fill="#ffffff">
          <animateMotion
            key={"craft" + month}
            dur="4s"
            repeatCount="indefinite"
            path={transferPath}
          />
        </circle>

        {/* Target: now (solid) and at arrival (dashed ring) */}
        <circle
          cx={targetAtArrival.x}
          cy={targetAtArrival.y}
          r="9"
          fill="none"
          stroke={color}
          strokeDasharray="2 2"
        />
        <circle cx={arrivalPoint.x} cy={arrivalPoint.y} r="3" fill={accent} />
        <text
          x={arrivalLabel.x}
          y={arrivalLabel.y}
          textAnchor={arrivalLabel.anchor}
          className="map-label"
        >
          {t.arrivalPoint}
        </text>
        <circle cx={targetNow.x} cy={targetNow.y} r="8" fill={color} />
        <text
          x={targetLabel.x}
          y={targetLabel.y}
          textAnchor={targetLabel.anchor}
          className="map-label map-label-strong"
        >
          {destination.id === "europa" ? t.jupiter : destination.name}
        </text>

        {/* Earth at launch */}
        <circle cx={earth.x} cy={earth.y} r="11" fill="rgba(79,155,232,0.18)" />
        <circle cx={earth.x} cy={earth.y} r="6" fill="#4f9be8" />
        <text
          x={earth.x}
          y={earth.y - 16}
          textAnchor="middle"
          className="map-label map-label-strong"
        >
          {t.earth}
          <tspan className="map-label-faint"> · {t.launchPoint}</tspan>
        </text>
      </svg>

      <ul className="map-legend">
        <li>
          <svg viewBox="0 0 16 8" aria-hidden="true">
            <line
              x1="0"
              y1="4"
              x2="16"
              y2="4"
              stroke={accent}
              strokeWidth="2"
            />
          </svg>
          {t.legendPath}
        </li>
        <li>
          <svg viewBox="0 0 16 8" aria-hidden="true">
            <line
              x1="1"
              y1="4"
              x2="15"
              y2="4"
              stroke={color}
              strokeWidth="2"
              strokeDasharray="1 4"
              strokeLinecap="round"
            />
          </svg>
          {t.legendMove}
        </li>
        <li>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle
              cx="8"
              cy="8"
              r="5"
              fill="none"
              stroke={color}
              strokeDasharray="2 2"
            />
          </svg>
          {t.whereLater}
        </li>
      </ul>
    </>
  );
}

function MoonMap() {
  const t = texts.ui.window;
  return (
    <svg
      className="orbit-map"
      viewBox="0 0 400 400"
      role="img"
      aria-label={t.earth + " · " + t.moon}
    >
      <circle
        cx="200"
        cy="200"
        r="150"
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeDasharray="2 5"
      />
      <circle cx="200" cy="200" r="22" fill="#4f9be8" />
      <text x="228" y="204" className="map-label">
        {t.earth}
      </text>
      <g className="moon-orbit">
        <circle cx="350" cy="200" r="9" fill="#b9b5ae" />
        <text x="320" y="225" className="map-label">
          {t.moon}
        </text>
      </g>
      <path
        className="transfer-path"
        d="M222,200 C260,120 330,130 345,190"
        fill="none"
        stroke="#5dcaa5"
        strokeWidth="1.6"
      />
      <text x="200" y="380" textAnchor="middle" className="map-label">
        {t.moonTrip}
      </text>
    </svg>
  );
}
