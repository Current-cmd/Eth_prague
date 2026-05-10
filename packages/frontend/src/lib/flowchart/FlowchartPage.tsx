import { useState, useCallback, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge,
} from "reactflow";
import "reactflow/dist/style.css";

import { NODES, EDGES, LAYER_COLORS, type FlowID, type LayerID } from "./graphData";

// ─── Layout ───────────────────────────────────────────────────────────────────

const LAYER_Y: Record<LayerID, number> = {
  actor:     0,
  frontend:  150,
  backend:   310,
  db:        460,
  contracts: 610,
  external:  760,
};

const NODE_WIDTH  = 190;
const NODE_HEIGHT = 44;
const H_GAP       = 210;

function buildRfNodes(): Node[] {
  const byLayer: Record<LayerID, typeof NODES> = {
    actor: [], frontend: [], backend: [], db: [], contracts: [], external: [],
  };
  for (const n of NODES) byLayer[n.layer].push(n);

  const rfNodes: Node[] = [];
  for (const [layer, group] of Object.entries(byLayer) as [LayerID, typeof NODES][]) {
    const count = group.length;
    const totalWidth = count * H_GAP;
    const startX = -(totalWidth / 2) + H_GAP / 2;

    group.forEach((n, i) => {
      rfNodes.push({
        id: n.id,
        data: { label: n.label },
        position: { x: startX + i * H_GAP, y: LAYER_Y[layer] },
        style: {
          background: LAYER_COLORS[layer],
          color: "#0f172a",
          border: n.stub ? "2px dashed #0f172a" : "1.5px solid #0f172a",
          borderRadius: 4,
          fontSize: 11,
          fontFamily: "monospace",
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center" as const,
          padding: "0 6px",
          opacity: n.stub ? 0.7 : 1,
        },
      });
    });
  }
  return rfNodes;
}

const ALL_RF_NODES = buildRfNodes();

function buildRfEdges(activeFlows: Set<FlowID>): Edge[] {
  return EDGES.filter((e) => activeFlows.has(e.flow)).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    labelStyle: { fontSize: 9, fontFamily: "monospace", fill: "#cbd5e1" },
    labelBgStyle: { fill: "#1e293b", fillOpacity: 0.85 },
    style: { stroke: "#475569", strokeWidth: 1.5 },
    animated: false,
  }));
}

// ─── Flow filter ──────────────────────────────────────────────────────────────

const ALL_FLOWS: FlowID[] = ["onboarding", "submit", "indexer", "admin", "viewing", "ens"];

const FLOW_COLORS: Record<FlowID, string> = {
  onboarding: "#60a5fa",
  submit:     "#f59e0b",
  indexer:    "#a78bfa",
  admin:      "#f97316",
  viewing:    "#34d399",
  ens:        "#22c55e",
};

// ─── Legend ───────────────────────────────────────────────────────────────────

const LAYER_LABELS: Record<LayerID, string> = {
  actor:     "Actor",
  frontend:  "Frontend",
  backend:   "Backend",
  db:        "Database",
  contracts: "Contracts",
  external:  "External",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FlowchartPage() {
  const [activeFlows, setActiveFlows] = useState<Set<FlowID>>(new Set(ALL_FLOWS));

  const toggleFlow = useCallback((flow: FlowID) => {
    setActiveFlows((prev) => {
      const next = new Set(prev);
      next.has(flow) ? next.delete(flow) : next.add(flow);
      return next;
    });
  }, []);

  const rfEdges = useMemo(() => buildRfEdges(activeFlows), [activeFlows]);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0f172a", display: "flex", flexDirection: "column" }}>
      {/* Flow filter bar */}
      <div style={{ display: "flex", gap: 8, padding: "10px 16px", background: "#1e293b", borderBottom: "1px solid #334155", flexWrap: "wrap", zIndex: 10 }}>
        <span style={{ fontFamily: "monospace", fontSize: 11, color: "#94a3b8", alignSelf: "center", marginRight: 4, textTransform: "uppercase", letterSpacing: "0.12em" }}>
          Flows:
        </span>
        {ALL_FLOWS.map((flow) => {
          const on = activeFlows.has(flow);
          return (
            <button
              key={flow}
              onClick={() => toggleFlow(flow)}
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                padding: "3px 10px",
                border: `1.5px solid ${FLOW_COLORS[flow]}`,
                borderRadius: 3,
                background: on ? FLOW_COLORS[flow] : "transparent",
                color: on ? "#0f172a" : FLOW_COLORS[flow],
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {flow}
            </button>
          );
        })}
        <button
          onClick={() => setActiveFlows(new Set(ALL_FLOWS))}
          style={{ fontFamily: "monospace", fontSize: 11, padding: "3px 10px", border: "1.5px solid #475569", borderRadius: 3, background: "transparent", color: "#94a3b8", cursor: "pointer", marginLeft: 4 }}
        >
          all
        </button>
        <button
          onClick={() => setActiveFlows(new Set())}
          style={{ fontFamily: "monospace", fontSize: 11, padding: "3px 10px", border: "1.5px solid #475569", borderRadius: 3, background: "transparent", color: "#94a3b8", cursor: "pointer" }}
        >
          none
        </button>
      </div>

      {/* React Flow canvas */}
      <div style={{ flex: 1, position: "relative" }}>
        <ReactFlow
          nodes={ALL_RF_NODES}
          edges={rfEdges}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#1e293b" gap={20} />
          <Controls style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 4 }} />

          {/* Layer legend */}
          <div style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 6,
            padding: "10px 14px",
            zIndex: 5,
          }}>
            <div style={{ fontFamily: "monospace", fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 8 }}>
              Layers
            </div>
            {(Object.entries(LAYER_COLORS) as [LayerID, string][]).map(([layer, color]) => (
              <div key={layer} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                <div style={{ width: 12, height: 12, background: color, borderRadius: 2, border: "1px solid #0f172a", flexShrink: 0 }} />
                <span style={{ fontFamily: "monospace", fontSize: 11, color: "#e2e8f0" }}>{LAYER_LABELS[layer]}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid #334155", marginTop: 8, paddingTop: 8 }}>
              <div style={{ fontFamily: "monospace", fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>Dashed border = stub</div>
            </div>
          </div>
        </ReactFlow>
      </div>
    </div>
  );
}
