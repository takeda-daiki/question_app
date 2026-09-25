import { useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Position,
  useNodesState,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Card, Notebook } from "../data/types";

export function Graph({
  cards,
  data,
  open,
}: {
  cards: Card[];
  data: Notebook;
  open: (id: string) => void;
}) {
  const initial = useMemo<Node[]>(
    () =>
      cards.map((c, i) => ({
        id: c.id,
        position: { x: (i % 4) * 230, y: Math.floor(i / 4) * 140 },
        data: { label: c.title },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: {
          background: c.status === "resolved" ? "#e1eee1" : "white",
          borderColor: "#799b80",
          borderRadius: 12,
          width: 185,
        },
      })),
    [cards],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(initial);
  useEffect(() => setNodes(initial), [initial, setNodes]);
  const ids = new Set(cards.map((c) => c.id));
  const edges = data.links
    .filter((l) => ids.has(l.card_a_id) && ids.has(l.card_b_id))
    .map((l) => ({
      id: l.id,
      source: l.card_a_id,
      target: l.card_b_id,
      type: "straight",
    }));
  return (
    <>
      <p className="muted">
        カードを選択すると詳細へ。ドラッグで配置を変えられます。配置はこの画面内だけに反映されます。
      </p>
      <div className="graph">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onNodeClick={(_, node) => open(node.id)}
          fitView
          nodesConnectable={false}
          deleteKeyCode={null}
          minZoom={0.1}
          maxZoom={2}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      {!cards.length && <p>この領域には対象のカードがありません。</p>}
    </>
  );
}
