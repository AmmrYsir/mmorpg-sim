// Shared constants — no imports, no mutable state.

export const TILE  = 16;   // px per tile
export const MAP_W = 50;   // tiles wide
export const MAP_H = 38;   // tiles tall

export const BATCH          = 20;   // NPCs updated per frame
export const GAME_SPEED     = 60;   // 1 real-sec = 60 in-game secs (1 in-game min/real-sec)
export const NPC_MOVE_SPEED = 12;   // in-game secs per tile step
export const NPC_LERP_ALPHA = 12;   // visual lerp factor (real-sec⁻¹)

export const T = Object.freeze({ GRASS:0, ROAD:1, BUILD:2, WATER:3, PLAZA:4, TREE:5 });

// Tile fill colours indexed by T.*
export const TCOL = Object.freeze(
  ['#7cb87c', '#9e9e8e', '#b0bec5', '#4fc3f7', '#d4c5a0', '#5a8a40']
  //  GRASS     ROAD      BUILD     WATER      PLAZA      TREE
);

// Building colour variants — assigned deterministically by tile position
export const BCOLS = Object.freeze(
  ['#b0bec5', '#c5cae9', '#ffe0b2', '#d7ccc8', '#f8bbd9', '#dcedc8']
);

export const ROLE_COLOR = Object.freeze({
  worker: '#4dabf7', merchant: '#fcc419', guard: '#ff6b6b', politician: '#cc5de8'
});

// [startHr, endHr, state]; startHr > endHr means the range crosses midnight
export const SCHED = Object.freeze({
  worker:     [[22,6,'sleep'],[6,8,'→work'],[8,17,'work'],[17,18,'→plaza'],[18,21,'social'],[21,22,'→home']],
  merchant:   [[22,7,'sleep'],[7,9,'→work'],[9,18,'work'],[18,19,'→plaza'],[19,21,'social'],[21,22,'→home']],
  guard:      [[23,6,'sleep'],[6,7,'→work'],[7,19,'work'],[19,20,'→plaza'],[20,22,'social'],[22,23,'→home']],
  politician: [[22,7,'sleep'],[7,8,'→work'],[8,16,'work'],[16,17,'govern'],[17,19,'→plaza'],[19,21,'social'],[21,22,'→home']]
});

export const DIRS4 = Object.freeze([[-1,0],[1,0],[0,-1],[0,1]]);

export const FNAMES = Object.freeze(['Aria','Bela','Cora','Dena','Elsa','Fara','Hana','Iris','Jana','Kira']);
export const MNAMES = Object.freeze(['Aldo','Bern','Cade','Dorn','Erik','Finn','Gale','Haro','Ivan','Jorn']);
