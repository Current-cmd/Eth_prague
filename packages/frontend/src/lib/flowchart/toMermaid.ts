import type { FlowNode, FlowEdge, LayerID } from "./graphData";
import { LAYER_COLORS } from "./graphData";

const LAYER_ORDER: LayerID[] = ["actor", "frontend", "backend", "db", "contracts", "external"];

export function toMermaid(nodes: FlowNode[], edges: FlowEdge[]): string {
  const stubIds = new Set(nodes.filter((n) => n.stub).map((n) => n.id));
  const lines: string[] = ["flowchart TD"];

  // Group nodes by layer and emit one subgraph per layer
  for (const layer of LAYER_ORDER) {
    const layerNodes = nodes.filter((n) => n.layer === layer);
    if (layerNodes.length === 0) continue;

    const layerLabel = layer.charAt(0).toUpperCase() + layer.slice(1);
    lines.push(`  subgraph ${layer}["${layerLabel}"]`);

    for (const node of layerNodes) {
      // Sanitise label: escape double-quotes
      const safeLabel = node.label.replace(/"/g, "'");
      lines.push(`    ${node.id}["${safeLabel}"]:::${layer}`);
    }

    lines.push("  end");
  }

  lines.push("");

  // Emit edges
  for (const edge of edges) {
    const safeLabel = edge.label.replace(/"/g, "'");
    const isStub = stubIds.has(edge.source) || stubIds.has(edge.target);
    const arrow = `  ${edge.source} -->|"${safeLabel}"| ${edge.target}`;
    lines.push(isStub ? `${arrow} %% stub` : arrow);
  }

  lines.push("");

  // classDef for each layer
  for (const [layer, color] of Object.entries(LAYER_COLORS)) {
    lines.push(`  classDef ${layer} fill:${color},stroke:#1e293b,color:#0f172a,rx:4`);
  }

  return lines.join("\n");
}
