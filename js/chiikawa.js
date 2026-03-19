// ============================================================
// CHARACTER AI — multi-character factory with drag-to-move
// ============================================================

// --- Shared constants ---

const CHAR_STATES = {
  IDLE: 'IDLE',
  IDLE_POSE: 'IDLE_POSE',
  WALKING: 'WALKING',
  ENTERING_HOUSE: 'ENTERING_HOUSE',
  INSIDE_HOUSE: 'INSIDE_HOUSE',
  EXITING_HOUSE: 'EXITING_HOUSE',
};

const FRAME_INTERVAL = 0.25;   // seconds per walk animation frame
const ROOM_WALK_SPEED = 8;     // percent per second (room movement)
const ARROW_BODY_SPACING = 35; // px between arrow body segments
const ARROW_DRAG_THRESHOLD = 8; // px movement to distinguish click vs drag

// ============================================================
// HOUSE STAY DURATION (seconds)
// Characters stay inside the house for a random duration
// between these two values. Increase for longer stays.
// ============================================================
const HOUSE_STAY_MIN = 30;
const HOUSE_STAY_MAX = 60;
// ============================================================

// --- Utility ---

function _randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function _screenToMap(screenX, screenY) {
  const { panX, panY, scale } = Viewport.getTransform();
  return { x: (screenX - panX) / scale, y: (screenY - panY) / scale };
}

// ============================================================
// GIF DETECTION — probes each pose path for a .gif version.
// Results are cached so the probe only fires once per path.
// Walk and idle frames are always .png (never probed).
// ============================================================
const _gifCache = new Map(); // png_path → resolved_path (.gif or .png)

function _resolveAndProbe(pngPath) {
  if (_gifCache.has(pngPath)) return _gifCache.get(pngPath);
  // Default to png while probing
  _gifCache.set(pngPath, pngPath);
  const gifPath = pngPath.replace(/\.png$/, '.gif');
  if (gifPath === pngPath) return pngPath; // not a .png path, skip
  const probe = new Image();
  probe.onload = () => _gifCache.set(pngPath, gifPath);
  probe.src = gifPath;
  return pngPath;
}

function buildSprites(name) {
  const base = 'asset/images/characters/';
  return {
    idle: base + name + '_idle_1.png',
    poses: [
      base + name + '_idle_pose_1.png',
      base + name + '_idle_pose_2.png',
      base + name + '_idle_pose_3.png',
      base + name + '_idle_pose_4.png',
    ],
    walkLeft:  base + name + '_walk_left.gif',
    walkRight: base + name + '_walk_right.gif',
  };
}

// ============================================================
// SHARED ROOM SYSTEM (one popup shared by all characters)
// ============================================================

const _room = {
  overlay: null, viewport: null, panLayer: null,
  closeBtn: null, base: null, studytable: null,
  zoomBtn: null,
  isOpen: false, panX: 0,
  dragging: false, dragStartX: 0, dragStartPanX: 0,
  initialized: false,
};

// All character instances
const Characters = [];

// Which character is currently being arrow-dragged (one at a time)
let _activeDragChar = null;

// Cached house object reference (set once during init)
let _houseObj = null;

function _clampRoomPan() {
  const vpW = _room.viewport.clientWidth;
  const vpH = _room.viewport.clientHeight;
  const layerW = _room.base.naturalWidth * (vpH / _room.base.naturalHeight);
  const minPan = vpW - layerW;
  _room.panX = minPan >= 0 ? 0 : Math.max(minPan, Math.min(0, _room.panX));
}

function _applyRoomPan() {
  _room.panLayer.style.transform = 'translateX(' + _room.panX + 'px)';
}

function _openRoom() {
  _room.isOpen = true;
  _room.overlay.classList.remove('hidden');

  requestAnimationFrame(() => {
    const vpH = _room.viewport.clientHeight;
    const aspect = _room.base.naturalWidth / _room.base.naturalHeight;
    const layerW = vpH * aspect;

    _room.panLayer.style.width = layerW + 'px';
    _room.panLayer.style.height = vpH + 'px';
    _room.studytable.style.left = '35%';
    _room.studytable.style.bottom = '30%';

    _room.panX = -(layerW - _room.viewport.clientWidth) / 2;
    _clampRoomPan();
    _applyRoomPan();
  });

  Characters.forEach(c => {
    c._updateRoomVisibility();
    if (c._state === CHAR_STATES.INSIDE_HOUSE) {
      c._roomX = _randomRange(15, 85);
      c._roomY = _randomRange(55, 90);
      c._roomClickCooldown = 0;
      c._setRoomState(CHAR_STATES.IDLE);
      c._renderRoom();
    }
  });
}

function _closeRoom() {
  _room.isOpen = false;
  _room.overlay.classList.add('hidden');
}

function _showZoomButton() {
  _room.zoomBtn.style.left = (_houseObj.x + _houseObj.w * 0.6) + 'px';
  _room.zoomBtn.style.top  = (_houseObj.y + _houseObj.h * 0.3) + 'px';
  _room.zoomBtn.classList.remove('hidden');
}

function _initSharedRoom() {
  if (_room.initialized) return;
  _room.initialized = true;

  // Cache house reference
  _houseObj = MAP_OBJECTS.find(o => o.id === 'house');

  _room.overlay    = document.getElementById('room-overlay');
  _room.viewport   = document.getElementById('room-viewport');
  _room.panLayer   = document.getElementById('room-pan-layer');
  _room.closeBtn   = document.getElementById('room-close-btn');
  _room.base       = document.getElementById('room-base');
  _room.studytable = document.getElementById('room-studytable');
  _room.zoomBtn    = document.getElementById('zoom-btn');

  // Zoom button
  const zb = _room.zoomBtn;
  zb.addEventListener('mousedown', e => e.stopPropagation());
  zb.addEventListener('touchstart', e => e.stopPropagation(), { passive: false });
  zb.addEventListener('click', e => { e.stopPropagation(); Viewport.cancelDrag(); _openRoom(); });
  zb.addEventListener('touchend', e => { e.stopPropagation(); e.preventDefault(); Viewport.cancelDrag(); _openRoom(); });

  // Room close
  _room.closeBtn.addEventListener('click', _closeRoom);
  _room.closeBtn.addEventListener('touchend', e => { e.preventDefault(); _closeRoom(); });

  // Room panning — unified pointer handler
  function getRoomPointerX(e) {
    return e.touches ? e.touches[0].clientX : e.clientX;
  }

  function onRoomPanStart(e) {
    if (e.touches && e.touches.length !== 1) return;
    _room.dragging = true;
    _room.dragStartX = getRoomPointerX(e);
    _room.dragStartPanX = _room.panX;
    e.preventDefault();
    e.stopPropagation();
  }

  function onRoomPanMove(e) {
    if (!_room.dragging) return;
    if (e.touches && !e.touches.length) return;
    if (e.touches) e.preventDefault();
    _room.panX = _room.dragStartPanX + (getRoomPointerX(e) - _room.dragStartX);
    _clampRoomPan();
    _applyRoomPan();
  }

  function onRoomPanEnd() {
    _room.dragging = false;
  }

  _room.viewport.addEventListener('mousedown', onRoomPanStart);
  _room.viewport.addEventListener('touchstart', onRoomPanStart, { passive: false });
  window.addEventListener('mousemove', onRoomPanMove);
  window.addEventListener('touchmove', onRoomPanMove, { passive: false });
  window.addEventListener('mouseup', onRoomPanEnd);
  window.addEventListener('touchend', onRoomPanEnd);

  _showZoomButton();
}

// ============================================================
// SHARED WINDOW-LEVEL DRAG LISTENERS
// Registered once, dispatch to whichever character is dragging.
// ============================================================

let _windowDragListenersAdded = false;

function _addWindowDragListeners() {
  if (_windowDragListenersAdded) return;
  _windowDragListenersAdded = true;

  function getPointer(e) {
    if (e.touches) return e.touches[0] || (e.changedTouches && e.changedTouches[0]);
    return e;
  }

  window.addEventListener('mousemove', e => {
    if (_activeDragChar) _activeDragChar._onDragMove(e.clientX, e.clientY);
  });

  window.addEventListener('touchmove', e => {
    if (!_activeDragChar) return;
    const t = getPointer(e);
    if (t) { e.preventDefault(); _activeDragChar._onDragMove(t.clientX, t.clientY); }
  }, { passive: false });

  window.addEventListener('mouseup', e => {
    if (_activeDragChar) _activeDragChar._onDragEnd(e.clientX, e.clientY);
  });

  window.addEventListener('touchend', e => {
    if (!_activeDragChar) return;
    const t = e.changedTouches && e.changedTouches[0];
    _activeDragChar._onDragEnd(t ? t.clientX : null, t ? t.clientY : null);
    e.preventDefault();
  });
}

// ============================================================
// CHARACTER FACTORY
// ============================================================

function createCharacter(config) {
  const { name, startX, startY, walkSpeed, spriteWidth = 100, spriteHeight = 100 } = config;
  const sprites = buildSprites(name);

  // --- Outdoor state ---
  let x = startX, y = startY;
  let state = CHAR_STATES.IDLE;
  let stateTimer = 0, stateDuration = 0;
  let targetX = 0, targetY = 0;
  let currentPose = 0;
  let visible = true;
  let clickCooldown = 0;

  // --- DOM refs ---
  let spriteEl = null, shadowEl = null;
  let roomSpriteEl = null, roomShadowEl = null;

  // --- Room character state ---
  let roomX = _randomRange(15, 85), roomY = _randomRange(55, 90);
  let roomState = CHAR_STATES.IDLE;
  let roomStateTimer = 0, roomStateDuration = 0;
  let roomTargetX = 0, roomTargetY = 0;
  let roomCurrentPose = 0;
  let roomClickCooldown = 0;

  // --- Sprite src tracking (for GIF restart on new pose) ---
  let lastOutdoorSrc = null;
  let lastRoomSrc = null;

  // --- Arrow drag state ---
  let dragging = false, dragMoved = false;
  let dragStartScreenX = 0, dragStartScreenY = 0;
  let arrowContainer = null;
  let arrowBodyEls = [];
  let arrowHeadEl = null;

  // --- Goal indicator ---
  let goalEl = null, showGoal = false;

  // --- Night behavior ---
  let nightReturnTimer = 0;   // countdown for outdoor characters to return home at night

  // ========================
  // INIT
  // ========================

  function init() {
    _initSharedRoom();
    _addWindowDragListeners();

    spriteEl     = document.getElementById(name + '-sprite');
    shadowEl     = document.getElementById(name + '-shadow');
    roomSpriteEl = document.getElementById('room-' + name + '-sprite');
    roomShadowEl = document.getElementById('room-' + name + '-shadow');

    // Set sprite dimensions once
    spriteEl.style.width  = spriteWidth + 'px';
    spriteEl.style.height = spriteHeight + 'px';

    // Probe all pose paths for GIF versions up-front
    sprites.poses.forEach(_resolveAndProbe);

    // Arrow container
    arrowContainer = document.createElement('div');
    arrowContainer.className = 'arrow-container';
    document.getElementById('map-container').appendChild(arrowContainer);

    // Goal indicator
    goalEl = document.createElement('div');
    goalEl.className = 'goal-indicator';
    const goalBase = document.createElement('img');
    goalBase.className = 'goal-base';
    goalBase.src = 'asset/images/goal_indicator.png';
    goalBase.draggable = false;
    const goalArrow = document.createElement('img');
    goalArrow.className = 'goal-arrow';
    goalArrow.src = 'asset/images/goal_arrow.png';
    goalArrow.draggable = false;
    goalEl.appendChild(goalBase);
    goalEl.appendChild(goalArrow);
    document.getElementById('map-container').appendChild(goalEl);

    // Outdoor drag — mousedown/touchstart on sprite only
    spriteEl.style.pointerEvents = 'auto';
    spriteEl.style.cursor = 'pointer';
    spriteEl.addEventListener('mousedown', onDragStart);
    spriteEl.addEventListener('touchstart', onDragStart, { passive: false });

    // Room character click
    roomSpriteEl.addEventListener('mousedown', e => e.stopPropagation());
    roomSpriteEl.addEventListener('touchstart', e => e.stopPropagation(), { passive: false });
    roomSpriteEl.addEventListener('click', onRoomClick);
    roomSpriteEl.addEventListener('touchend', e => { e.stopPropagation(); e.preventDefault(); onRoomClick(e); });

    setState(CHAR_STATES.IDLE);
  }

  // ========================
  // ARROW DRAG
  // ========================

  function onDragStart(e) {
    e.stopPropagation();
    if (state === CHAR_STATES.INSIDE_HOUSE || state === CHAR_STATES.ENTERING_HOUSE) return;
    if (_activeDragChar && _activeDragChar !== character) return;
    if (e.touches) e.preventDefault();

    const ptr = e.touches ? e.touches[0] : e;
    dragging = true;
    dragMoved = false;
    dragStartScreenX = ptr.clientX;
    dragStartScreenY = ptr.clientY;
    _activeDragChar = character;
    Viewport.cancelDrag();
  }

  // Called by shared window listener
  function onDragMove(clientX, clientY) {
    if (!dragging) return;
    const dx = clientX - dragStartScreenX;
    const dy = clientY - dragStartScreenY;

    if (!dragMoved && (Math.abs(dx) > ARROW_DRAG_THRESHOLD || Math.abs(dy) > ARROW_DRAG_THRESHOLD)) {
      dragMoved = true;
    }
    if (dragMoved) {
      const end = _screenToMap(clientX, clientY);
      updateArrowTrail(x, y - spriteHeight * 0.45, end.x, end.y);
    }
  }

  // Called by shared window listener
  function onDragEnd(clientX, clientY) {
    if (!dragging) return;
    dragging = false;
    _activeDragChar = null;

    if (dragMoved && clientX != null) {
      const end = _screenToMap(clientX, clientY);
      const tx = Math.max(50, Math.min(1950, end.x));
      const ty = Math.max(50, Math.min(950, end.y));
      walkTo(tx, ty);
    } else if (!dragMoved) {
      // Click/tap — trigger idle pose
      if (clickCooldown <= 0 && (state === CHAR_STATES.IDLE || state === CHAR_STATES.IDLE_POSE || state === CHAR_STATES.WALKING)) {
        Viewport.cancelDrag();
        setState(CHAR_STATES.IDLE_POSE);
        clickCooldown = stateDuration;
      }
    }
    clearArrowTrail();
  }

  // ========================
  // ARROW TRAIL RENDERING
  // ========================

  function updateArrowTrail(startX, startY, endX, endY) {
    const dx = endX - startX;
    const dy = endY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    const headSize = 30;
    const bodyDist = Math.max(0, dist - headSize);
    const totalSegments = Math.max(0, Math.floor(bodyDist / ARROW_BODY_SPACING));
    const numVisible = Math.max(0, totalSegments - 1); // skip first segment (inside character)
    const bodySize = 22;

    // Create body elements as needed (pooled)
    while (arrowBodyEls.length < numVisible) {
      const img = document.createElement('img');
      img.src = 'asset/images/arrow_body.png';
      img.className = 'arrow-body';
      img.draggable = false;
      arrowContainer.appendChild(img);
      arrowBodyEls.push(img);
    }

    for (let i = 0; i < arrowBodyEls.length; i++) {
      if (i < numVisible) {
        const segDist = (i + 2) * ARROW_BODY_SPACING;
        const bx = startX + Math.cos(angle) * segDist;
        const by = startY + Math.sin(angle) * segDist;
        const el = arrowBodyEls[i];
        el.style.display = 'block';
        el.style.left   = (bx - bodySize / 2) + 'px';
        el.style.top    = (by - bodySize / 2) + 'px';
        el.style.width  = bodySize + 'px';
        el.style.height = bodySize + 'px';
      } else {
        arrowBodyEls[i].style.display = 'none';
      }
    }

    // Arrow head (finger pointing right, rotated to match direction)
    const arrowHeadSize = 40;
    if (!arrowHeadEl) {
      arrowHeadEl = document.createElement('img');
      arrowHeadEl.src = 'asset/images/arrow_head.png';
      arrowHeadEl.className = 'arrow-head';
      arrowHeadEl.draggable = false;
      arrowContainer.appendChild(arrowHeadEl);
    }
    arrowHeadEl.style.display = 'block';
    arrowHeadEl.style.left    = (endX - arrowHeadSize / 2) + 'px';
    arrowHeadEl.style.top     = (endY - arrowHeadSize / 2) + 'px';
    arrowHeadEl.style.width   = arrowHeadSize + 'px';
    arrowHeadEl.style.height  = arrowHeadSize + 'px';
    arrowHeadEl.style.transform = 'rotate(' + angle + 'rad)';
  }

  function clearArrowTrail() {
    for (let i = 0; i < arrowBodyEls.length; i++) arrowBodyEls[i].style.display = 'none';
    if (arrowHeadEl) arrowHeadEl.style.display = 'none';
  }

  // ========================
  // PLAYER-DIRECTED WALK
  // ========================

  function walkTo(mapX, mapY) {
    if (state === CHAR_STATES.INSIDE_HOUSE || state === CHAR_STATES.ENTERING_HOUSE) return;
    targetX = mapX;
    targetY = mapY;
    state = CHAR_STATES.WALKING;
    stateTimer = 0;
    showGoal = true;
    updateGoalIndicator();
  }

  function updateGoalIndicator() {
    if (showGoal) {
      goalEl.style.display = 'block';
      goalEl.style.left = (targetX - 20) + 'px';
      goalEl.style.top  = (targetY - 7) + 'px';
    } else {
      goalEl.style.display = 'none';
    }
  }

  function hideGoalIndicator() {
    showGoal = false;
    goalEl.style.display = 'none';
  }

  // ========================
  // NIGHT — force characters indoors
  // ========================

  function goHomeForNight() {
    if (state === CHAR_STATES.INSIDE_HOUSE || state === CHAR_STATES.ENTERING_HOUSE) return;
    setState(CHAR_STATES.ENTERING_HOUSE);
  }

  function scheduleMorningExit() {
    if (state === CHAR_STATES.INSIDE_HOUSE) {
      // Reset the inside-house timer to a short random delay (0–3 s) so the
      // character exits via the normal INSIDE_HOUSE timeout path
      stateTimer = 0;
      stateDuration = _randomRange(0, 3);
    }
  }

  // ========================
  // ROOM CLICK
  // ========================

  function onRoomClick(e) {
    e.stopPropagation();
    if (roomClickCooldown > 0) return;
    if (roomState === CHAR_STATES.IDLE || roomState === CHAR_STATES.IDLE_POSE || roomState === CHAR_STATES.WALKING) {
      setRoomState(CHAR_STATES.IDLE_POSE);
      roomClickCooldown = roomStateDuration;
    }
  }

  // ========================
  // ROOM VISIBILITY & AI
  // ========================

  function updateRoomVisibility() {
    const show = state === CHAR_STATES.INSIDE_HOUSE;
    roomSpriteEl.style.display = show ? 'block' : 'none';
    roomShadowEl.style.display = show ? 'block' : 'none';
  }

  function setRoomState(newState) {
    roomState = newState;
    roomStateTimer = 0;

    switch (newState) {
      case CHAR_STATES.IDLE:
        roomStateDuration = _randomRange(2, 5);
        break;
      case CHAR_STATES.IDLE_POSE:
        roomCurrentPose = Math.floor(Math.random() * sprites.poses.length);
        roomStateDuration = 2;
        lastRoomSrc = null; // force GIF to restart on next render
        break;
      case CHAR_STATES.WALKING:
        roomTargetX = _randomRange(15, 85);
        roomTargetY = _randomRange(55, 90);
        break;
    }
  }

  function updateRoom(dt) {
    if (!_room.isOpen || state !== CHAR_STATES.INSIDE_HOUSE) return;

    if (roomClickCooldown > 0) roomClickCooldown -= dt;
    roomStateTimer += dt;

    switch (roomState) {
      case CHAR_STATES.IDLE:
        if (roomStateTimer >= roomStateDuration) {
          if (Math.random() < 0.3) setRoomState(CHAR_STATES.IDLE_POSE);
          else setRoomState(CHAR_STATES.WALKING);
        }
        break;
      case CHAR_STATES.IDLE_POSE:
        if (roomStateTimer >= roomStateDuration) setRoomState(CHAR_STATES.IDLE);
        break;
      case CHAR_STATES.WALKING: {
        const rdx = roomTargetX - roomX;
        const rdy = roomTargetY - roomY;
        const rdist = Math.sqrt(rdx * rdx + rdy * rdy);
        if (rdist < 1) {
          setRoomState(CHAR_STATES.IDLE);
        } else {
          roomX += (rdx / rdist) * ROOM_WALK_SPEED * dt;
          roomY += (rdy / rdist) * ROOM_WALK_SPEED * dt;
        }
        break;
      }
    }
    renderRoom();
  }

  function getRoomSprite() {
    switch (roomState) {
      case CHAR_STATES.IDLE:      return sprites.idle;
      case CHAR_STATES.IDLE_POSE: return sprites.poses[roomCurrentPose];
      case CHAR_STATES.WALKING:
        return roomTargetX > roomX ? sprites.walkRight : sprites.walkLeft;
      default: return sprites.idle;
    }
  }

  function renderRoom() {
    const rawSrc = getRoomSprite();
    const src = _resolveAndProbe(rawSrc);
    if (lastRoomSrc !== src) {
      roomSpriteEl.src = src;
      lastRoomSrc = src;
    }

    const bottomPct = 100 - roomY;
    roomSpriteEl.style.left   = (roomX - 7.5) + '%';
    roomSpriteEl.style.bottom = bottomPct + '%';
    roomShadowEl.style.left   = (roomX - 5) + '%';
    roomShadowEl.style.bottom = (bottomPct - 2) + '%';

    // Z-ordering: higher roomY = closer to camera = higher z-index
    const roomZ = Math.round(roomY * 0.5);
    roomSpriteEl.style.zIndex = roomZ + 1;
    roomShadowEl.style.zIndex = roomZ;
  }

  // ========================
  // MAIN STATE MACHINE
  // ========================

  function isOverlappingHouse() {
    return x > _houseObj.x && x < _houseObj.x + _houseObj.w &&
           y > _houseObj.y && y < _houseObj.y + _houseObj.h;
  }

  function setState(newState) {
    state = newState;
    stateTimer = 0;

    if (newState !== CHAR_STATES.WALKING && newState !== CHAR_STATES.ENTERING_HOUSE) {
      hideGoalIndicator();
    }

    switch (newState) {
      case CHAR_STATES.IDLE:
        stateDuration = _randomRange(2, 5);
        break;
      case CHAR_STATES.IDLE_POSE:
        currentPose = Math.floor(Math.random() * sprites.poses.length);
        stateDuration = 2;
        lastOutdoorSrc = null; // force GIF to restart on next render
        break;
      case CHAR_STATES.WALKING:
        pickWalkTarget();
        break;
      case CHAR_STATES.ENTERING_HOUSE:
        targetX = HOUSE_DOOR.x;
        targetY = HOUSE_DOOR.y;
        break;
      case CHAR_STATES.INSIDE_HOUSE:
        visible = false;
        stateDuration = _randomRange(HOUSE_STAY_MIN, HOUSE_STAY_MAX);
        if (_room.isOpen) {
          updateRoomVisibility();
          roomX = _randomRange(15, 85);
          roomY = _randomRange(55, 90);
          setRoomState(CHAR_STATES.IDLE);
          renderRoom();
        }
        break;
      case CHAR_STATES.EXITING_HOUSE:
        if (_room.isOpen) updateRoomVisibility();
        x = HOUSE_DOOR.x;
        y = HOUSE_DOOR.y + 30;
        visible = true;
        setState(CHAR_STATES.IDLE);
        break;
    }
  }

  function pickWalkTarget() {
    if (Math.random() < 0.85) {
      targetX = _randomRange(100, 1900);
      targetY = _randomRange(400, 900);
    } else {
      targetX = _randomRange(100, 1900);
      targetY = _randomRange(150, 400);
    }
  }

  function update(dt) {
    if (clickCooldown > 0) clickCooldown -= dt;
    stateTimer += dt;

    const night = DayNight.isNight();

    // Night return timer: outdoor characters head home when it expires
    if (night && nightReturnTimer > 0 && state !== CHAR_STATES.INSIDE_HOUSE && state !== CHAR_STATES.ENTERING_HOUSE) {
      nightReturnTimer -= dt;
      if (nightReturnTimer <= 0) {
        setState(CHAR_STATES.ENTERING_HOUSE);
      }
    }

    switch (state) {
      case CHAR_STATES.IDLE:
        if (stateTimer >= stateDuration) {
          if (night) {
            // At night, go home immediately
            setState(CHAR_STATES.ENTERING_HOUSE);
          } else {
            const roll = Math.random();
            if (roll < 0.3) setState(CHAR_STATES.IDLE_POSE);
            else if (roll < 0.85) setState(CHAR_STATES.WALKING);
            else setState(CHAR_STATES.ENTERING_HOUSE);
          }
        }
        break;
      case CHAR_STATES.IDLE_POSE:
        if (stateTimer >= stateDuration) setState(CHAR_STATES.IDLE);
        break;
      case CHAR_STATES.WALKING:
        updateWalk(dt);
        if (state === CHAR_STATES.WALKING && isOverlappingHouse()) {
          setState(CHAR_STATES.ENTERING_HOUSE);
        }
        break;
      case CHAR_STATES.ENTERING_HOUSE:
        updateWalk(dt);
        break;
      case CHAR_STATES.INSIDE_HOUSE:
        if (stateTimer >= stateDuration) {
          if (night) {
            // 15% chance to briefly go outside at night
            if (Math.random() < 0.15) {
              nightReturnTimer = _randomRange(15, 30);
              setState(CHAR_STATES.EXITING_HOUSE);
            } else {
              // Stay inside, reset timer
              stateTimer = 0;
              stateDuration = _randomRange(HOUSE_STAY_MIN, HOUSE_STAY_MAX);
            }
          } else {
            setState(CHAR_STATES.EXITING_HOUSE);
          }
        }
        break;
    }
    updateRoom(dt);
  }

  function updateWalk(dt) {
    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 5) {
      hideGoalIndicator();
      if (state === CHAR_STATES.ENTERING_HOUSE) setState(CHAR_STATES.INSIDE_HOUSE);
      else setState(CHAR_STATES.IDLE);
      return;
    }
    x += (dx / dist) * walkSpeed * dt;
    y += (dy / dist) * walkSpeed * dt;
  }

  function getCurrentSprite() {
    switch (state) {
      case CHAR_STATES.IDLE:
      case CHAR_STATES.EXITING_HOUSE:
        return sprites.idle;
      case CHAR_STATES.IDLE_POSE:
        return sprites.poses[currentPose];
      case CHAR_STATES.WALKING:
      case CHAR_STATES.ENTERING_HOUSE:
        return targetX > x ? sprites.walkRight : sprites.walkLeft;
      default: return sprites.idle;
    }
  }

  function render() {
    if (!visible) {
      spriteEl.style.display = 'none';
      shadowEl.style.display = 'none';
      return;
    }

    spriteEl.style.display = 'block';
    shadowEl.style.display = 'block';

    spriteEl.style.left = (x - spriteWidth / 2) + 'px';
    spriteEl.style.top  = (y - spriteHeight * 0.9) + 'px';
    shadowEl.style.left = (x - 30) + 'px';
    shadowEl.style.top  = (y - 8) + 'px';

    const rawSrc = getCurrentSprite();
    const src = _resolveAndProbe(rawSrc);
    if (lastOutdoorSrc !== src) {
      spriteEl.src = src;
      lastOutdoorSrc = src;
    }
  }

  function getBaseline() {
    return { spriteId: name + '-sprite', shadowId: name + '-shadow', baseline: y };
  }

  function getAllSpritePaths() {
    return [sprites.idle, ...sprites.poses, sprites.walkLeft, sprites.walkRight];
  }

  // ========================
  // PUBLIC INTERFACE
  // ========================

  const character = {
    name,
    init, update, render,
    getBaseline, getAllSpritePaths,
    // Shared room system hooks
    get _state() { return state; },
    _updateRoomVisibility: updateRoomVisibility,
    get _roomX() { return roomX; },     set _roomX(v) { roomX = v; },
    get _roomY() { return roomY; },     set _roomY(v) { roomY = v; },
    get _roomClickCooldown() { return roomClickCooldown; },
    set _roomClickCooldown(v) { roomClickCooldown = v; },
    _setRoomState: setRoomState,
    _renderRoom: renderRoom,
    _goHomeForNight: goHomeForNight,
    _scheduleMorningExit: scheduleMorningExit,
    // Drag dispatch hooks (called by shared window listeners)
    _onDragMove: onDragMove,
    _onDragEnd: onDragEnd,
  };

  return character;
}

// ============================================================
// CHARACTER INSTANCES
// ============================================================

Characters.push(createCharacter({ name: 'chiikawa',  startX: 550, startY: 400, walkSpeed: 80 }));
Characters.push(createCharacter({ name: 'hachiware', startX: 650, startY: 450, walkSpeed: 80 }));
Characters.push(createCharacter({ name: 'usagi',     startX: 500, startY: 500, walkSpeed: 120, spriteWidth: 100, spriteHeight: 130 }));

// ============================================================
// Z-ORDER (called each frame after all characters render)
// ============================================================

function applyAllCharacterZOrder() {
  const baselines = [];
  for (let i = 0; i < Characters.length; i++) {
    const b = Characters[i].getBaseline();
    const el = document.getElementById(b.spriteId);
    if (el && el.style.display !== 'none') baselines.push(b);
  }
  applyZOrder(baselines);
}
