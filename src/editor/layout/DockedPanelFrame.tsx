import type { CSSProperties, ReactNode } from "react";

export type DockedPanelFrameProps = {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

export default function DockedPanelFrame({ className, style, children }: DockedPanelFrameProps) {
  return (
    <aside className={className} style={style}>
      {children}
    </aside>
  );
}
