// ============================================================
// VIEWPORT — pan, zoom, pinch-to-zoom
// ============================================================

const Viewport = (() => {
  const MAP_W = 2000;
  const MAP_H = 1000;

  let scale = 1, minScale = 1, maxScale = 3;
  let panX = 0, panY = 0;
  let isDragging = false, dragMoved = false;
  let dragStartX = 0, dragStartY = 0;
  let lastPointerX = 0, lastPointerY = 0;
  let pinchStartDist = 0, pinchStartScale = 0;

  let mapContainer = null;
  let gameViewport = null;

  function init() {
    mapContainer = document.getElementById('map-container');
    gameViewport = document.getElementById('game-viewport');

    calcInitialScale();
    applyTransform();

    // Mouse
    gameViewport.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', () => { isDragging = false; });
    gameViewport.addEventListener('wheel', onWheel, { passive: false });

    // Touch
    gameViewport.addEventListener('touchstart', onTouchStart, { passive: false });
    gameViewport.addEventListener('touchmove', onTouchMove, { passive: false });
    gameViewport.addEventListener('touchend', onTouchEnd, { passive: false });
    gameViewport.addEventListener('touchcancel', onTouchEnd, { passive: false });

    window.addEventListener('resize', () => { calcInitialScale(); applyTransform(); });
  }

  function calcInitialScale() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    scale = vh / MAP_H;
    minScale = scale;
    maxScale = scale * 3;
    panX = (vw - MAP_W * scale) / 2;
    panY = 0;
    clampPan();
  }

  function clampPan() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mapW = MAP_W * scale;
    const mapH = MAP_H * scale;

    panX = mapW <= vw ? (vw - mapW) / 2 : Math.min(0, Math.max(vw - mapW, panX));
    panY = mapH <= vh ? (vh - mapH) / 2 : Math.min(0, Math.max(vh - mapH, panY));
  }

  function applyTransform() {
    mapContainer.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + scale + ')';
  }

  function clamp(val, lo, hi) {
    return Math.min(hi, Math.max(lo, val));
  }

  function zoomAt(cx, cy, factor) {
    const newScale = clamp(scale * factor, minScale, maxScale);
    const ratio = newScale / scale;
    panX = cx - (cx - panX) * ratio;
    panY = cy - (cy - panY) * ratio;
    scale = newScale;
    clampPan();
    applyTransform();
  }

  // --- Mouse ---

  function onMouseDown(e) {
    if (e.button !== 0) return;
    isDragging = true;
    dragMoved = false;
    dragStartX = lastPointerX = e.clientX;
    dragStartY = lastPointerY = e.clientY;
  }

  function onMouseMove(e) {
    if (!isDragging) return;
    if (Math.abs(e.clientX - dragStartX) > 5 || Math.abs(e.clientY - dragStartY) > 5) dragMoved = true;
    panX += e.clientX - lastPointerX;
    panY += e.clientY - lastPointerY;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    clampPan();
    applyTransform();
  }

  function onWheel(e) {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, e.deltaY > 0 ? 0.93 : 1.07);
  }

  // --- Touch ---

  function touchDist(t) {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function touchMid(t) {
    return { x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 };
  }

  function onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      isDragging = true;
      dragMoved = false;
      dragStartX = lastPointerX = e.touches[0].clientX;
      dragStartY = lastPointerY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      isDragging = false;
      pinchStartDist = touchDist(e.touches);
      pinchStartScale = scale;
    }
  }

  function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1 && isDragging) {
      const t = e.touches[0];
      if (Math.abs(t.clientX - dragStartX) > 5 || Math.abs(t.clientY - dragStartY) > 5) dragMoved = true;
      panX += t.clientX - lastPointerX;
      panY += t.clientY - lastPointerY;
      lastPointerX = t.clientX;
      lastPointerY = t.clientY;
      clampPan();
      applyTransform();
    } else if (e.touches.length === 2) {
      const newScale = clamp(pinchStartScale * (touchDist(e.touches) / pinchStartDist), minScale, maxScale);
      const mid = touchMid(e.touches);
      const ratio = newScale / scale;
      panX = mid.x - (mid.x - panX) * ratio;
      panY = mid.y - (mid.y - panY) * ratio;
      scale = newScale;
      clampPan();
      applyTransform();
    }
  }

  function onTouchEnd(e) {
    e.preventDefault();
    if (e.touches.length === 0) {
      isDragging = false;
    } else if (e.touches.length === 1) {
      isDragging = true;
      lastPointerX = e.touches[0].clientX;
      lastPointerY = e.touches[0].clientY;
    }
  }

  // --- Public ---

  function cancelDrag() { isDragging = false; dragMoved = false; }
  function getTransform() { return { panX, panY, scale }; }

  return { init, cancelDrag, getTransform };
})();
