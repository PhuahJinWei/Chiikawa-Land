// ============================================================
// GAME — boot, image preload, and main loop
// ============================================================

const Game = (() => {
  let lastTime = 0;

  function preloadImages(paths) {
    return Promise.all(paths.map(src =>
      new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => { console.warn('Failed to load: ' + src); resolve(img); };
        img.src = src;
      })
    ));
  }

  function getAllImagePaths() {
    const paths = [
      // Day
      'asset/images/base_day.png',
      'asset/images/background.png',
      'asset/images/shadow_1.png',
      // Room shadows reuse shadow_1.png / shadow_2.png (no separate room shadow)
      'asset/images/house_1.png',
      'asset/images/bush_1.png',
      'asset/images/bush_2.png',
      'asset/images/stump.png',
      // Night
      'asset/images/base_night.png',
      'asset/images/shadow_2.png',
      'asset/images/house_night_1.png',
      'asset/images/bush_night_1.png',
      'asset/images/bush_night_2.png',
      // UI
      'asset/images/arrow_body.png',
      'asset/images/arrow_head.png',
      'asset/images/goal_indicator.png',
      'asset/images/goal_arrow.png',
      'asset/images/text_field_1.png',
      'asset/images/text_field_2.png',
      // Room
      'asset/images/room/base.png',
      'asset/images/room/studytable.png',
      'asset/images/room/window_frame.png',
      'asset/images/buttons/zoom.png',
      'asset/images/buttons/room_close.png',
      'asset/images/buttons/menu.png',
      'asset/images/buttons/close.png',
    ];
    Characters.forEach(c => paths.push(...c.getAllSpritePaths()));
    return paths;
  }

  async function init() {
    await preloadImages(getAllImagePaths());
    createMapObjects();
    Viewport.init();
    Characters.forEach(c => c.init());
    DayNight.init();
    Menu.init();
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function loop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    DayNight.update(dt);
    Characters.forEach(c => c.update(dt));
    Characters.forEach(c => c.render());
    applyAllCharacterZOrder();

    requestAnimationFrame(loop);
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
