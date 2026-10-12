import { useDroppable } from "@dnd-kit/core";
import type { TaskStatus } from "../../domain/task/Task";
export default function StageDropTarget({ status, title, reason, current = false }: { status: TaskStatus; title: string; reason: string | null; current?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `destination-${status}`, data: { status } });
  return <div ref={setNodeRef} data-destination={status} className="stage-drop-target" data-drop-state={current ? "neutral" : reason ? "invalid" : "valid"} data-over={isOver || undefined}><strong>{title}</strong><span>{reason ?? "Ready to receive"}</span></div>;
}
