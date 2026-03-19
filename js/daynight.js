// ============================================================
// DAY/NIGHT CYCLE
// ============================================================

const DayNight = (() => {
  // ============================================================
  // CYCLE CONFIGURATION (seconds)
  const DAY_DURATION        = 210; // 3.5 minutes
  const NIGHT_DURATION      = 90;  // 1.5 minutes
  const BANNER_SHOW_DURATION = 5;  // seconds the "Day X" banner stays visible
  const STATUS_SHOW_DURATION = 5;  // seconds the status notification stays visible
  // ============================================================

  let timer = 0;
  let _isNight = false;
  let dayCount = 1;

  // --- Day banner (top center, text_field_1.png) ---
  let mapBase      = null;
  let bannerEl     = null;
  let bannerTextEl = null;
  let bannerTimer  = 0;
  let bannerVisible = false;

  // --- Status banner (bottom center, text_field_2.png) ---
  let statusEl      = null;
  let statusTextEl  = null;
  let statusTimer   = 0;
  let statusVisible = false;

  // Image paths
  const IMG_BASE_DAY    = 'asset/images/base_day.png';
  const IMG_BASE_NIGHT  = 'asset/images/base_night.png';
  const IMG_SHADOW_DAY  = 'asset/images/shadow_1.png';
  const IMG_SHADOW_NIGHT = 'asset/images/shadow_2.png';

  // -------------------------------------------------------

  function init() {
    mapBase      = document.getElementById('map-base');
    bannerEl     = document.getElementById('day-banner');
    bannerTextEl = document.getElementById('day-text');
    statusEl     = document.getElementById('status-banner');
    statusTextEl = document.getElementById('status-text');

    _isNight = false;
    timer    = 0;
    dayCount = 1;
    applyDayState(true);
    showDayBanner();
  }

  function update(dt) {
    timer += dt;
    const duration = _isNight ? NIGHT_DURATION : DAY_DURATION;

    if (timer >= duration) {
      timer -= duration;
      if (_isNight) {
        // Night → Morning
        _isNight = false;
        dayCount++;
        applyDayState(false);
        showDayBanner();
        showStatus('朝になりました！');
      } else {
        // Day → Night
        _isNight = true;
        applyNightState();
        showStatus('夜になりました！');
      }
    }

    // Day banner timer
    if (bannerVisible) {
      bannerTimer += dt;
      if (bannerTimer >= BANNER_SHOW_DURATION) hideDayBanner();
    }

    // Status banner timer
    if (statusVisible) {
      statusTimer += dt;
      if (statusTimer >= STATUS_SHOW_DURATION) hideStatus();
    }
  }

  // skipInitial: true = game start (don't schedule morning exits, no status)
  function applyDayState(skipInitial) {
    mapBase.src = IMG_BASE_DAY;
    setObjectsNightMode(false);
    updateCharacterShadows(false);
    if (!skipInitial) {
      // Characters exit the house at a random delay (0–3 s)
      Characters.forEach(c => c._scheduleMorningExit());
    }
    _updateTimeButton();
  }

  function applyNightState() {
    mapBase.src = IMG_BASE_NIGHT;
    setObjectsNightMode(true);
    updateCharacterShadows(true);
    Characters.forEach(c => c._goHomeForNight());
    _updateTimeButton();
  }

  function updateCharacterShadows(night) {
    const src = night ? IMG_SHADOW_NIGHT : IMG_SHADOW_DAY;
    document.querySelectorAll('.character-shadow').forEach(el => { el.src = src; });
  }

  // --- Day banner ---
  function showDayBanner() {
    bannerTextEl.textContent = dayCount + '日目';
    bannerEl.classList.remove('hidden', 'banner-hide');
    bannerEl.classList.add('banner-show');
    bannerVisible = true;
    bannerTimer = 0;
  }

  function hideDayBanner() {
    bannerEl.classList.remove('banner-show');
    bannerEl.classList.add('banner-hide');
    bannerVisible = false;
  }

  // --- Status banner ---
  function showStatus(text) {
    statusTextEl.textContent = text;
    statusEl.classList.remove('hidden', 'status-hide');
    statusEl.classList.add('status-show');
    statusVisible = true;
    statusTimer = 0;
  }

  function hideStatus() {
    statusEl.classList.remove('status-show');
    statusEl.classList.add('status-hide');
    statusVisible = false;
  }

  // --- Menu time button ---
  function _updateTimeButton() {
    const btn = document.getElementById('time-toggle-btn');
    if (btn) btn.textContent = _isNight ? '朝にする' : '夜にする';
  }

  // Called by the menu button to immediately skip to the next time of day
  function skipTime() {
    if (_isNight) {
      _isNight = false;
      timer = 0;
      dayCount++;
      applyDayState(false);
      showDayBanner();
      showStatus('朝になりました！');
    } else {
      _isNight = true;
      timer = 0;
      applyNightState();
      showStatus('夜になりました！');
    }
  }

  return {
    init,
    update,
    isNight:    () => _isNight,
    getDayCount: () => dayCount,
    skipTime,
  };
})();
