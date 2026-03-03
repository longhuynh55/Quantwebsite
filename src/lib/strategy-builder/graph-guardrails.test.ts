import { createStrategyNodeFromPaletteType } from "@/components/strategy-builder/nodeFactory";
import {
  applyStrategyPatchOps,
  sanitizeStrategyGraph,
  summarizeGraphDiff,
  type StrategyPatchOp,
} from "@/lib/strategy-builder/graph-guardrails";
import type { StrategyEdge, StrategyNode } from "@/lib/stores/strategyBuilderStore";

function makeNode(type: string, id: string, x: number, y: number): StrategyNode {
  const node = createStrategyNodeFromPaletteType(type, { x, y });
  if (!node) {
    throw new Error(`Failed to create node for ${type}`);
  }
  node.id = id;
  return node;
}

describe("graph-guardrails", () => {
  test("drops orphan/self-loop/invalid-transition edges", () => {
    const nodes = [
      makeNode("dataSource", "n1", 10, 10),
      makeNode("indicator", "n2", 200, 10),
      makeNode("output", "n3", 380, 10),
    ];
    const edges: StrategyEdge[] = [
      { id: "e-ok", source: "n1", target: "n2" },
      { id: "e-self", source: "n2", target: "n2" },
      { id: "e-orphan", source: "n2", target: "n-missing" },
      { id: "e-invalid", source: "n1", target: "n3" },
    ];

    const out = sanitizeStrategyGraph(nodes, edges);
    expect(out.edges.map((edge) => edge.id)).toEqual(["e-ok"]);
    expect(out.isValid).toBe(false);
    expect(out.issues.some((issue) => issue.code === "EDGE_SELF_LOOP")).toBe(true);
    expect(out.issues.some((issue) => issue.code === "EDGE_ORPHAN")).toBe(true);
    expect(out.issues.some((issue) => issue.code === "EDGE_TYPE_TRANSITION_INVALID")).toBe(true);
  });

  test("dedupes duplicate node ids by remapping", () => {
    const nodeA = makeNode("dataSource", "dup", 10, 10);
    const nodeB = makeNode("indicator", "dup", 20, 20);

    const out = sanitizeStrategyGraph([nodeA, nodeB], []);
    const ids = out.nodes.map((node) => node.id);
    expect(new Set(ids).size).toBe(2);
    expect(out.issues.some((issue) => issue.code === "NODE_ID_DUPLICATE")).toBe(true);
  });

  test("flags invalid node payload entries without throwing", () => {
    const out = sanitizeStrategyGraph([null as unknown as StrategyNode], []);
    expect(out.isValid).toBe(false);
    expect(out.nodes).toHaveLength(0);
    expect(out.issues.some((issue) => issue.code === "NODE_INVALID")).toBe(true);
  });

  test("remaps duplicate edge ids to keep ids unique", () => {
    const nodes = [
      makeNode("dataSource", "n1", 10, 10),
      makeNode("indicator", "n2", 200, 10),
      makeNode("signal", "n3", 380, 10),
    ];
    const edges: StrategyEdge[] = [
      { id: "dup-edge", source: "n1", target: "n2" },
      { id: "dup-edge", source: "n2", target: "n3" },
    ];

    const out = sanitizeStrategyGraph(nodes, edges);
    expect(new Set(out.edges.map((edge) => edge.id)).size).toBe(out.edges.length);
    expect(out.issues.some((issue) => issue.code === "EDGE_ID_DUPLICATE")).toBe(true);
  });

  test("applies patch operations with diff summary", () => {
    const baseNodes = [makeNode("dataSource", "src", 10, 10), makeNode("indicator", "ind", 200, 10)];
    const baseEdges: StrategyEdge[] = [{ id: "e1", source: "src", target: "ind" }];
    const ops: StrategyPatchOp[] = [
      {
        op: "add_node",
        nodeType: "signal",
        nodeId: "sig",
        label: "Buy Signal",
      },
      {
        op: "add_edge",
        source: "ind",
        target: "sig",
      },
      {
        op: "update_node",
        nodeId: "sig",
        config: { condition: "RSI < 30" },
      },
    ];

    const out = applyStrategyPatchOps(baseNodes, baseEdges, ops);
    expect(out.isValid).toBe(true);
    expect(out.appliedOps).toBe(3);
    expect(out.nodes.some((node) => node.id === "sig")).toBe(true);
    expect(out.edges.some((edge) => edge.source === "ind" && edge.target === "sig")).toBe(true);
    expect(out.diffSummary.length).toBeGreaterThan(0);
  });

  test("rejects add_node when node id is duplicated", () => {
    const baseNodes = [makeNode("dataSource", "src", 10, 10)];
    const out = applyStrategyPatchOps(baseNodes, [], [
      {
        op: "add_node",
        nodeType: "indicator",
        nodeId: "src",
      },
    ]);

    expect(out.isValid).toBe(false);
    expect(out.appliedOps).toBe(0);
    expect(out.issues.some((issue) => issue.code === "PATCH_ADD_NODE_DUPLICATE_ID")).toBe(true);
  });

  test("summarizes unchanged graph", () => {
    const nodes = [makeNode("dataSource", "a", 0, 0)];
    const summary = summarizeGraphDiff(nodes, [], nodes, []);
    expect(summary).toEqual(["No graph changes detected."]);
  });
});
