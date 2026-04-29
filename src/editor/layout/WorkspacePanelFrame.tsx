import type { CSSProperties, ReactNode, PointerEventHandler } from "react";
import type { WorkspaceDockSide, WorkspacePanelDefinition } from "./panelRegistry";

export type WorkspacePanelFrameProps = {
  panel: WorkspacePanelDefinition;
  mode: "docked" | "floating" | "hidden";
  className?: string;
  style?: CSSProperties;
  dockSide?: WorkspaceDockSide;
  onHeaderPointerDown?: PointerEventHandler<HTMLDivElement>;
  onToggleMode: () => void;
  onCycleDockSide?: () => void;
  onHide: () => void;
  children: ReactNode;
};

export default function WorkspacePanelFrame({
  panel,
  mode,
  className,
  style,
  dockSide,
  onHeaderPointerDown,
  onToggleMode,
  onCycleDockSide,
  onHide,
  children,
}: WorkspacePanelFrameProps) {
  return (
    <aside className={`${className ?? ""} panel ${dockSide ?? panel.side} ${mode}`.trim()} style={style}>
      <div className="panel-heading panel-header" onPointerDown={onHeaderPointerDown}>
        <div className="eyebrow">{panel.title}</div>
        <div className="panel-header-row">
          <div className="panel-heading-copy">{panel.summary}</div>
          <div className="panel-actions">
            <button onClick={onToggleMode}>{mode === "floating" ? "Dock" : "Float"}</button>
            {onCycleDockSide ? <button onClick={onCycleDockSide}>{dockSide === "left" ? "Move right" : dockSide === "right" ? "Move left" : "Move"}</button> : null}
            <button onClick={onHide}>Hide</button>
          </div>
        </div>
      </div>
      {children}
    </aside>
  );
}
