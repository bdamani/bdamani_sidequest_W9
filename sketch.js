/*
  Week 9 — Example 3: Adding Sound & Music

  Course: GBDA302 | Instructors: Dr. Karen Cochrane & David Han
  Date: Mar. 19, 2026

  Controls:
    A or D (Left / Right Arrow)   Horizontal movement
    W (Up Arrow)                  Jump
    Space Bar                     Attack

  Tile key:
    g = groundTile.png       (surface ground)
    d = groundTileDeep.png   (deep ground, below surface)
      = empty (no sprite)
*/

let player;
let playerImg, bgImg;
let jumpSfx, musicSfx;
let musicStarted = false;

let playerAnis = {
  idle: { row: 0, frames: 4, frameDelay: 10 },
  run: { row: 1, frames: 4, frameDelay: 3 },
  jump: { row: 2, frames: 3, frameDelay: Infinity, frame: 0 },
  attack: { row: 3, frames: 6, frameDelay: 2 },
};

let ground, groundDeep;
let groundImg, groundDeepImg;

let attacking = false; // track if the player is attacking
let attackFrameCounter = 0; // tracking attack animation

// --- TILE MAP ---
// an array that uses the tile key to create the level
let level = [
  "              ",
  "              ",
  "              ",
  "              ",
  "              ",
  "       ggg    ",
  "gggggggggggggg", // surface ground
  "dddddddddddddd", // deep ground
];

// --- LEVEL CONSTANTS ---
// camera view size
const VIEWW = 320,
  VIEWH = 180;

// tile width & height
const TILE_W = 24,
  TILE_H = 24;

// size of individual animation frames
const FRAME_W = 32,
  FRAME_H = 32;

// Y-coordinate of player start (4 tiles above the bottom)
const MAP_START_Y = VIEWH - TILE_H * 4;

// gravity
const GRAVITY = 10;
const MOON_GRAVITY = 2;
let usingMoonGravity = false;

// speed boost state
const NORMAL_SPEED = 1.5;
const BOOST_SPEED = 3.0;
const BOOST_DURATION = 180; // frames (~3s at 60fps)
const BOOST_COOLDOWN = 240; // frames (~4s at 60fps)
let speedBoostActive = false;
let speedBoostTimer = 0;
let speedBoostCooldown = 0;

function preload() {
  // --- IMAGES ---
  playerImg = loadImage("assets/foxSpriteSheet.png");
  bgImg = loadImage("assets/combinedBackground.png");
  groundImg = loadImage("assets/groundTile.png");
  groundDeepImg = loadImage("assets/groundTileDeep.png");

  // --- SOUND ---
  if (typeof loadSound === "function") {
    jumpSfx = loadSound("assets/sfx/jump.wav");
    musicSfx = loadSound("assets/sfx/music.wav");
  }
}

function setup() {
  // pixelated rendering with autoscaling
  new Canvas(VIEWW, VIEWH, "pixelated");

  // needed to correct an visual artifacts from attempted antialiasing
  allSprites.pixelPerfect = true;

  world.gravity.y = GRAVITY;

  // Try to start background music immediately.
  if (musicSfx) musicSfx.setLoop(true);
  startMusicIfNeeded();

  // --- TILE GROUPS ---
  ground = new Group();
  ground.physics = "static";
  ground.img = groundImg;
  ground.tile = "g";

  groundDeep = new Group();
  groundDeep.physics = "static";
  groundDeep.img = groundDeepImg;
  groundDeep.tile = "d";

  // a Tiles object creates a level based on the level map array (defined at the beginning)
  new Tiles(level, 0, 0, TILE_W, TILE_H);

  // --- PLAYER ---
  player = new Sprite(FRAME_W, MAP_START_Y, FRAME_W, FRAME_H); // create the player
  player.spriteSheet = playerImg; // use the sprite sheet
  player.rotationLock = true; // turn off rotations (player shouldn't rotate)

  // player animation parameters
  player.anis.w = FRAME_W;
  player.anis.h = FRAME_H;
  player.anis.offset.y = -4; // offset the collision box up
  player.addAnis(playerAnis); // add the player animations defined earlier
  player.ani = "idle"; // default to the idle animation
  player.w = 18; // set the width of the collsion box
  player.h = 20; // set the height of the collsion box
  player.friction = 0; // set the friciton to 0 so we don't stick to walls
  player.bounciness = 0; // set the bounciness to 0 so the player doesn't bounce

  // --- GROUND SENSOR --- for use when detecting if the player is standing on the ground
  sensor = new Sprite();
  sensor.x = player.x;
  sensor.y = player.y + player.h / 2;
  sensor.w = player.w;
  sensor.h = 2;
  sensor.mass = 0.01;
  sensor.removeColliders();
  sensor.visible = false;
  let sensorJoint = new GlueJoint(player, sensor);
  sensorJoint.visible = false;
}

function startMusicIfNeeded() {
  if (musicStarted || !musicSfx) return;

  const startLoop = () => {
    if (!musicSfx.isPlaying()) musicSfx.play();
    musicStarted = musicSfx.isPlaying();
  };

  // Some browsers require a user gesture before audio can start.
  const maybePromise = userStartAudio();
  if (maybePromise && typeof maybePromise.then === "function") {
    maybePromise.then(startLoop).catch(() => {});
  } else {
    startLoop();
  }
}

function keyPressed() {
  startMusicIfNeeded();

  if (key === 'm' || key === 'M') {
    usingMoonGravity = !usingMoonGravity;
    world.gravity.y = usingMoonGravity ? MOON_GRAVITY : GRAVITY;
  }

  if ((key === 'f' || key === 'F') && !speedBoostActive && speedBoostCooldown <= 0) {
    speedBoostActive = true;
    speedBoostTimer = BOOST_DURATION;
    speedBoostCooldown = BOOST_COOLDOWN;
  }
}

function mousePressed() {
  startMusicIfNeeded();
}

function touchStarted() {
  startMusicIfNeeded();
  return false;
}

function draw() {
  // --- BACKGROUND ---
  camera.off();
  imageMode(CORNER);
  image(bgImg, 0, 0, bgImg.width, bgImg.height);
  camera.on();

  // --- PLAYER CONTROLS ---
  // first check to see if the player is on the ground
  let grounded = sensor.overlapping(ground);

  // -- ATTACK INPUT --
  if (grounded && !attacking && kb.presses("space")) {
    attacking = true;
    attackFrameCounter = 0;
    player.vel.x = 0;
    player.ani.frame = 0;
    player.ani = "attack";
    player.ani.play(); // plays once to end
  }

  // -- JUMP --
  if (grounded && kb.presses("up")) {
    player.vel.y = -4;
    if (jumpSfx) jumpSfx.play();
  }

  // --- STATE MACHINE ---
  if (attacking) {
    attackFrameCounter++;
    // Attack lasts ~6 frames * frameDelay 2 = 12 cycles (adjust if needed)
    if (attackFrameCounter > 12) {
      attacking = false;
      attackFrameCounter = 0;
    }
  } else if (!grounded) {
    player.ani = "jump";
    player.ani.frame = player.vel.y < 0 ? 0 : 1;
  } else {
    player.ani = kb.pressing("left") || kb.pressing("right") ? "run" : "idle";
  }

  // --- SPEED BOOST TIMING ---
  if (speedBoostActive) {
    speedBoostTimer--;
    if (speedBoostTimer <= 0) {
      speedBoostActive = false;
      speedBoostTimer = 0;
    }
  } else if (speedBoostCooldown > 0) {
    speedBoostCooldown--;
  }

  const currentSpeed = speedBoostActive ? BOOST_SPEED : NORMAL_SPEED;

  // --- MOVEMENT ---
  if (!attacking) {
    player.vel.x = 0;
    if (kb.pressing("left")) {
      player.vel.x = -currentSpeed;
      player.mirror.x = true;
    } else if (kb.pressing("right")) {
      player.vel.x = currentSpeed;
      player.mirror.x = false;
    }
  }

  // --- KEEP IN VIEW ---
  player.pos.x = constrain(player.pos.x, FRAME_W / 2, VIEWW - FRAME_W / 2);
  player.pos.y = constrain(player.pos.y, FRAME_H / 2, VIEWH - FRAME_H / 2);

  // keep sensor aligned with player
  sensor.x = player.x;
  sensor.y = player.y + player.h / 2;

  camera.off();
  fill(255);
  stroke(0);
  strokeWeight(2);
  textSize(10);
  textAlign(LEFT, TOP);
  text(
    "Gravity: " + (usingMoonGravity ? "Moon" : "Earth") + " (M to toggle)",
    4,
    4
  );

  const speedLabel = speedBoostActive
    ? "Boost active"
    : speedBoostCooldown > 0
    ? "Boost cooldown: " + ceil(speedBoostCooldown / 60) + "s"
    : "Boost ready (F)";

  text(speedLabel, 4, 18);
  camera.on();
}
