// ============================================================
// MENU — slide-out panel toggle
// ============================================================

const Menu = (() => {
  let isOpen = false;
  let btnImg = null;
  let panel  = null;

  function init() {
    btnImg = document.getElementById('menu-btn-img');
    panel  = document.getElementById('menu-panel');

    document.getElementById('menu-btn').addEventListener('click', e => {
      e.stopPropagation();
      toggle();
    });

    // Time-toggle button
    document.getElementById('time-toggle-btn').addEventListener('click', e => {
      e.stopPropagation();
      DayNight.skipTime();
      toggle(); // close menu after action
    });
  }

  function toggle() {
    isOpen = !isOpen;
    btnImg.src = isOpen ? 'asset/images/buttons/close.png' : 'asset/images/buttons/menu.png';
    panel.classList.toggle('hidden', !isOpen);
  }

  return { init };
})();
