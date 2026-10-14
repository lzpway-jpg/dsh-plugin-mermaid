/**
 * Diagram lightbox: a singleton fullscreen overlay for one rendered Mermaid
 * SVG, cloned — never moved — from its inline container. Opens fitted to the
 * window; zooms by buttons or wheel around the cursor; pans by drag once the
 * content overflows the viewport. Closes on the × button, Escape, or a
 * backdrop press, restoring body scroll. Pure DOM: the shell's React tree is
 * never involved.
 */

/** Localized chrome for the lightbox. */
export interface LightboxLabels {
  readonly zoomIn: string
  readonly zoomOut: string
  readonly fit: string
  readonly close: string
}

/** One open lightbox's teardown. */
export type CloseLightbox = () => void

/** Padding kept between the fitted diagram and the viewport edges. */
const FIT_PADDING = 48
/** Scale clamp relative to the SVG's natural pixel size. */
const MIN_SCALE = 0.05
const MAX_SCALE = 20
/** Button zoom step. */
const STEP = 1.25
/** Content must stay at least this visible while panning. */
const MIN_VISIBLE_PX = 60

/** Natural size of a rendered Mermaid SVG: its viewBox, else its displayed box. */
function naturalSize(svg: SVGSVGElement): { width: number; height: number } {
  const viewBox = svg.viewBox?.baseVal
  if (viewBox !== undefined && viewBox.width > 0 && viewBox.height > 0) {
    return { width: viewBox.width, height: viewBox.height }
  }
  const rect = svg.getBoundingClientRect()
  return { width: rect.width || 1, height: rect.height || 1 }
}

/**
 * Open the lightbox for one rendered SVG.
 * @param svg - the inline diagram to clone.
 * @param labels - localized control copy.
 * @param onClose - called exactly once after teardown.
 * @returns the close function.
 */
export function openDiagramLightbox(svg: SVGSVGElement, labels: LightboxLabels, onClose: () => void): CloseLightbox {
  const { width, height } = naturalSize(svg)

  const backdrop = document.createElement('div')
  backdrop.className = 'dsh-mermaid-lightbox'
  backdrop.setAttribute('data-dsh-mermaid', '')

  const topbar = document.createElement('div')
  topbar.className = 'dsh-mermaid-lightbox-topbar'
  const zoomOut = document.createElement('button')
  zoomOut.type = 'button'
  zoomOut.className = 'dsh-mermaid-lightbox-button'
  zoomOut.title = labels.zoomOut
  zoomOut.textContent = '−'
  const scaleLabel = document.createElement('button')
  scaleLabel.type = 'button'
  scaleLabel.className = 'dsh-mermaid-lightbox-button dsh-mermaid-lightbox-scale'
  scaleLabel.title = labels.fit
  const zoomIn = document.createElement('button')
  zoomIn.type = 'button'
  zoomIn.className = 'dsh-mermaid-lightbox-button'
  zoomIn.title = labels.zoomIn
  zoomIn.textContent = '+'
  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.className = 'dsh-mermaid-lightbox-button'
  closeButton.title = labels.close
  closeButton.textContent = '×'
  topbar.append(zoomOut, scaleLabel, zoomIn, closeButton)

  const viewport = document.createElement('div')
  viewport.className = 'dsh-mermaid-lightbox-viewport'
  const canvas = document.createElement('div')
  canvas.className = 'dsh-mermaid-lightbox-canvas'
  const frame = document.createElement('div')
  frame.className = 'dsh-mermaid-lightbox-frame'
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  clone.style.maxWidth = 'none'
  frame.appendChild(clone)
  canvas.appendChild(frame)
  viewport.appendChild(canvas)
  backdrop.append(viewport, topbar)
  document.body.appendChild(backdrop)

  // Zoom/pan math works on the framed card (diagram plus its padding), measured once laid out.
  const contentWidth = frame.offsetWidth || width
  const contentHeight = frame.offsetHeight || height

  let scale = 1
  let translateX = 0
  let translateY = 0
  let closed = false

  const overflows = (): boolean => {
    const vw = viewport.clientWidth
    const vh = viewport.clientHeight
    return contentWidth * scale > vw || contentHeight * scale > vh
  }

  const apply = (): void => {
    canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`
    scaleLabel.textContent = `${Math.round(scale * 100)}%`
    viewport.classList.toggle('is-pannable', overflows())
  }

  const clampTranslate = (): void => {
    const vw = viewport.clientWidth
    const vh = viewport.clientHeight
    const cw = contentWidth * scale
    const ch = contentHeight * scale
    translateX = Math.min(vw - MIN_VISIBLE_PX, Math.max(MIN_VISIBLE_PX - cw, translateX))
    translateY = Math.min(vh - MIN_VISIBLE_PX, Math.max(MIN_VISIBLE_PX - ch, translateY))
  }

  /** Re-anchor at `anchor` (viewport coordinates) so the content point under it stays fixed. */
  const zoomTo = (next: number, anchorX: number, anchorY: number): void => {
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next))
    if (clamped === scale) return
    const rect = viewport.getBoundingClientRect()
    const x = anchorX - rect.left
    const y = anchorY - rect.top
    const ratio = clamped / scale
    translateX = x - (x - translateX) * ratio
    translateY = y - (y - translateY) * ratio
    scale = clamped
    clampTranslate()
    apply()
  }

  const fit = (): void => {
    const vw = Math.max(1, viewport.clientWidth - FIT_PADDING * 2)
    const vh = Math.max(1, viewport.clientHeight - FIT_PADDING * 2)
    scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(vw / contentWidth, vh / contentHeight)))
    translateX = (viewport.clientWidth - contentWidth * scale) / 2
    translateY = (viewport.clientHeight - contentHeight * scale) / 2
    apply()
  }

  const center = (): { x: number; y: number } => {
    const rect = viewport.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  }

  zoomIn.addEventListener('click', () => {
    const { x, y } = center()
    zoomTo(scale * STEP, x, y)
  })
  zoomOut.addEventListener('click', () => {
    const { x, y } = center()
    zoomTo(scale / STEP, x, y)
  })
  scaleLabel.addEventListener('click', fit)
  closeButton.addEventListener('click', () => close())

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault()
    zoomTo(scale * Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY)
  }
  viewport.addEventListener('wheel', onWheel, { passive: false })

  let dragging = false
  let moved = false
  let lastX = 0
  let lastY = 0
  const onPointerMove = (event: PointerEvent): void => {
    if (!dragging) return
    const dx = event.clientX - lastX
    const dy = event.clientY - lastY
    if (dx !== 0 || dy !== 0) moved = true
    lastX = event.clientX
    lastY = event.clientY
    translateX += dx
    translateY += dy
    clampTranslate()
    apply()
  }
  const onPointerUp = (): void => {
    dragging = false
    viewport.classList.remove('is-dragging')
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }
  viewport.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !overflows()) return
    dragging = true
    moved = false
    lastX = event.clientX
    lastY = event.clientY
    viewport.classList.add('is-dragging')
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    event.preventDefault()
  })
  // A press that starts and ends on the backdrop (not a drag) closes the lightbox.
  viewport.addEventListener('click', (event) => {
    if (event.target === viewport && !moved) close()
  })

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    // The modal owns Escape while open: the shell's own handlers must not fire.
    event.stopPropagation()
    event.preventDefault()
    close()
  }
  window.addEventListener('keydown', onKeyDown, true)

  const previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'

  function close(): void {
    if (closed) return
    closed = true
    onPointerUp()
    viewport.removeEventListener('wheel', onWheel)
    window.removeEventListener('keydown', onKeyDown, true)
    document.body.style.overflow = previousOverflow
    backdrop.remove()
    onClose()
  }

  fit()
  return close
}
