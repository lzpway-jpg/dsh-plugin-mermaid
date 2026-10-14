/**
 * Styles for the Mermaid diagram container, injected as one `<style>` tag and
 * removed on unload. Colors stick to theme-neutral translucent grays and
 * inherited text color so the container reads in both light and dark skins
 * without coupling to the shell's token names.
 */
export const MERMAID_CSS = `
.dsh-mermaid {
  position: relative;
  margin: 4px 0;
  padding: 12px 16px;
  border: 1px solid rgba(127, 127, 127, 0.28);
  border-radius: 8px;
  overflow: auto;
}
.dsh-mermaid.is-collapsed {
  padding: 6px 12px;
}
.dsh-mermaid-diagram {
  display: flex;
  justify-content: center;
  cursor: zoom-in;
}
.dsh-mermaid-diagram > svg {
  max-width: 100%;
  height: auto;
}
.dsh-mermaid.is-collapsed .dsh-mermaid-diagram {
  display: none;
}
.dsh-mermaid-toolbar {
  position: absolute;
  top: 6px;
  right: 8px;
  display: flex;
  gap: 6px;
}
.dsh-mermaid.is-collapsed .dsh-mermaid-toolbar {
  position: static;
  display: flex;
  justify-content: flex-end;
}
.dsh-mermaid-toggle {
  font: inherit;
  font-size: 12px;
  line-height: 1.4;
  padding: 2px 10px;
  border: 1px solid rgba(127, 127, 127, 0.35);
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.65;
}
.dsh-mermaid-toggle:hover {
  opacity: 1;
}
.dsh-mermaid-lightbox {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(12, 14, 18, 0.45);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  animation: dsh-mermaid-fade-in 160ms ease-out;
}
body[data-ds-dark-theme] .dsh-mermaid-lightbox {
  background: rgba(0, 0, 0, 0.58);
}
.dsh-mermaid-lightbox-viewport {
  position: absolute;
  inset: 0;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}
.dsh-mermaid-lightbox-viewport.is-pannable {
  cursor: grab;
}
.dsh-mermaid-lightbox-viewport.is-dragging {
  cursor: grabbing;
}
.dsh-mermaid-lightbox-canvas {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
}
.dsh-mermaid-lightbox-frame {
  padding: 20px 24px;
  background: #ffffff;
  border: 1px solid rgba(16, 24, 40, 0.08);
  border-radius: 14px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28), 0 4px 16px rgba(0, 0, 0, 0.12);
  animation: dsh-mermaid-pop-in 180ms cubic-bezier(0.2, 0.9, 0.25, 1.12);
}
body[data-ds-dark-theme] .dsh-mermaid-lightbox-frame {
  background: #202024;
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55), 0 4px 16px rgba(0, 0, 0, 0.4);
}
.dsh-mermaid-lightbox-frame > svg {
  display: block;
}
.dsh-mermaid-lightbox-topbar {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  z-index: 1;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(16, 24, 40, 0.08);
  border-radius: 999px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
body[data-ds-dark-theme] .dsh-mermaid-lightbox-topbar {
  background: rgba(34, 34, 38, 0.88);
  border-color: rgba(255, 255, 255, 0.1);
}
.dsh-mermaid-lightbox-button {
  font: inherit;
  font-size: 15px;
  line-height: 1;
  min-width: 32px;
  padding: 7px 9px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #333333;
  cursor: pointer;
}
.dsh-mermaid-lightbox-button:hover {
  background: rgba(16, 24, 40, 0.07);
}
body[data-ds-dark-theme] .dsh-mermaid-lightbox-button {
  color: #e8e8ea;
}
body[data-ds-dark-theme] .dsh-mermaid-lightbox-button:hover {
  background: rgba(255, 255, 255, 0.09);
}
.dsh-mermaid-lightbox-scale {
  min-width: 60px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
@keyframes dsh-mermaid-fade-in {
  from {
    opacity: 0;
  }
}
@keyframes dsh-mermaid-pop-in {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
}
@media (prefers-reduced-motion: reduce) {
  .dsh-mermaid-lightbox,
  .dsh-mermaid-lightbox-frame {
    animation: none;
  }
}
`
