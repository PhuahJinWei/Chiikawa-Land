// ============================================================
// MAP OBJECTS — positions, sizes, and z-ordering
// ============================================================

// ============================================================
// OBJECT SIZE CONFIGURATION
// Scale values: 1.0 = original size, 0.5 = half, 2.0 = double
// ============================================================
const OBJECT_SCALES = {
  house:  1.5,   // house_1.png (original: 200x150)
  bush_1: 0.65,  // bush_1.png  (original: 218x152)
  bush_2: 0.65,  // bush_2.png  (original: 249x149)
  stump:  0.65,  // stump.png   (original: 329x129)
};

const ORIGINAL_SIZES = {
  house:  { w: 200, h: 150 },
  bush_1: { w: 218, h: 152 },
  bush_2: { w: 249, h: 149 },
  stump:  { w: 329, h: 129 },
};
// ============================================================

function scaledSize(type) {
  const s = OBJECT_SCALES[type];
  const o = ORIGINAL_SIZES[type];
  return { w: Math.round(o.w * s), h: Math.round(o.h * s) };
}

// Night image lookup by type
const NIGHT_IMAGES = {
  house:  'asset/images/house_night_1.png',
  bush_1: 'asset/images/bush_night_1.png',
  bush_2: 'asset/images/bush_night_2.png',
};

// Map object definitions
const MAP_OBJECTS = [
  // House
  { id: 'house',   img: 'asset/images/house_1.png', x: 850,  y: 200, ...scaledSize('house'),  type: 'house' },
  // Bushes
  { id: 'bush_1a', img: 'asset/images/bush_1.png',  x: 20,   y: 150, ...scaledSize('bush_1'), type: 'bush_1' },
  { id: 'bush_2a', img: 'asset/images/bush_2.png',  x: 340,  y: 30,  ...scaledSize('bush_2'), type: 'bush_2' },
  { id: 'bush_1b', img: 'asset/images/bush_1.png',  x: 620,  y: 65,  ...scaledSize('bush_1'), type: 'bush_1' },
  { id: 'bush_1c', img: 'asset/images/bush_1.png',  x: 280,  y: 290, ...scaledSize('bush_1'), type: 'bush_1' },
  { id: 'bush_2b', img: 'asset/images/bush_2.png',  x: 1150, y: 130, ...scaledSize('bush_2'), type: 'bush_2' },
  { id: 'bush_2c', img: 'asset/images/bush_2.png',  x: 1450, y: 210, ...scaledSize('bush_2'), type: 'bush_2' },
  { id: 'bush_1d', img: 'asset/images/bush_1.png',  x: 1300, y: 430, ...scaledSize('bush_1'), type: 'bush_1' },
  { id: 'bush_2d', img: 'asset/images/bush_2.png',  x: 200,  y: 560, ...scaledSize('bush_2'), type: 'bush_2' },
  { id: 'bush_1e', img: 'asset/images/bush_1.png',  x: 1500, y: 630, ...scaledSize('bush_1'), type: 'bush_1' },
  { id: 'bush_1f', img: 'asset/images/bush_1.png',  x: 30,   y: 760, ...scaledSize('bush_1'), type: 'bush_1' },
  { id: 'bush_2e', img: 'asset/images/bush_2.png',  x: 1350, y: 770, ...scaledSize('bush_2'), type: 'bush_2' },
  // Stump
  { id: 'stump',   img: 'asset/images/stump.png',   x: 580,  y: 640, ...scaledSize('stump'),  type: 'stump' },
];

// Compute bottom-edge baseline for each object
MAP_OBJECTS.forEach(obj => { obj.zBaseline = obj.y + obj.h; });

// House door position (where characters walk to enter)
const HOUSE_DOOR = (() => {
  const house = MAP_OBJECTS.find(o => o.id === 'house');
  return {
    x: house.x + Math.round(house.w * 0.47),
    y: house.y + Math.round(house.h * 0.93),
  };
})();

// Create DOM elements for all map objects
function createMapObjects() {
  const container = document.getElementById('map-container');
  const firstChar = container.querySelector('.character-shadow');

  MAP_OBJECTS.forEach(obj => {
    const img = document.createElement('img');
    img.id = obj.id;
    img.src = obj.img;
    img.className = 'map-object';
    img.draggable = false;
    img.style.left   = obj.x + 'px';
    img.style.top    = obj.y + 'px';
    img.style.width  = obj.w + 'px';
    img.style.height = obj.h + 'px';
    container.insertBefore(img, firstChar);
  });
}

// ============================================================
// Z-ORDER THRESHOLD
// Controls when characters appear in front of vs behind objects.
// 0.0 = character always on top when overlapping
// 0.5 = character on top in bottom 50% of object
// 0.7 = character on top in bottom 30% of object (current)
// 1.0 = character always behind when overlapping
// ============================================================
const Z_ORDER_THRESHOLD = 0.7;
// ============================================================

// Swap map object images between day and night variants
function setObjectsNightMode(night) {
  MAP_OBJECTS.forEach(obj => {
    const nightSrc = NIGHT_IMAGES[obj.type];
    if (!nightSrc) return; // no night variant (e.g. stump)
    const el = document.getElementById(obj.id);
    if (el) el.src = night ? nightSrc : obj.img;
  });
}

// Sort characters and map objects by Y baseline for correct layering
function applyZOrder(characterBaselines) {
  const allItems = [];

  MAP_OBJECTS.forEach(obj => {
    allItems.push({ id: obj.id, zBaseline: obj.y + obj.h * Z_ORDER_THRESHOLD });
  });

  characterBaselines.forEach(cb => {
    allItems.push({ id: cb.shadowId, zBaseline: cb.baseline - 1 });
    allItems.push({ id: cb.spriteId, zBaseline: cb.baseline });
  });

  allItems.sort((a, b) => a.zBaseline - b.zBaseline);

  for (let i = 0; i < allItems.length; i++) {
    const el = document.getElementById(allItems[i].id);
    if (el) el.style.zIndex = i + 1;
  }
}
