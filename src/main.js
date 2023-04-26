'use strict';

module.exports = Parabola;

var data = require('./data.js');

var GLState = require('./gl-state.js');
var GLPool = require('./gl-pool.js');
var Scene = require('./scene.js');
var SolidModel = require('./solid-model.js');
var Mtrl = require('./mtrl.js');
var Batch = require('./batch.js');
var Solid = require('./solid.js');

function Parabola(options) {
  if (!(this instanceof Parabola)) {
    return new Parabola(options);
  }

  this.options = Object.assign(
    Object.create(null),
    Parabola.defaultOptions,
    options,
  );

  this.canvas = this.options.canvas;
  this.state = GLState(this.canvas);
  this.pool = GLPool();
  this.scene = Scene();
  this.images = Object.create(null);

  this.setup();
}

Parabola.defaultOptions = {
  canvas: null,
  dataUrl: '/data/',
  isInteractive: true,
  hasOverlay: false,
  gradientImage: 'back/alien',
  modelPaths: {
    gradient: 'geom/back/back.sol',
    background: 'map-back/alien.sol',
    level: 'map-fwp/adventure.sol',
    coin: 'item/coin/coin.sol',
    coin5: 'item/coin/coin5.sol',
    coin10: 'item/coin/coin10.sol',
    grow: 'item/grow/grow.sol',
    shrink: 'item/shrink/shrink.sol',
    jump: 'geom/beam/beam.sol',
    ballInner: 'ball/reactor/reactor-inner.sol',
    ballSolid: 'ball/reactor/reactor-solid.sol',
    ballOuter: 'ball/reactor/reactor-outer.sol'
  },
};

Parabola.prototype.setup = function () {
  var canvas = this.canvas;
  var state = this.state;
  var pool = this.pool;
  var scene = this.scene;
  var gl = state.gl;

  var animationRequestId = 0;

  canvas.addEventListener('webglcontextlost', function (event) {
    event.preventDefault();
    window.cancelAnimationFrame(animationRequestId);
    animationRequestId = 0;
  });

  canvas.addEventListener('webglcontextrestored', function (event) {
    state.init(canvas);
    pool.createObjects();
    animationRequestId = window.requestAnimationFrame(processFrame);
  });

  // GL object creation.

  function createObjects(resource) {
    resource.createObjects(state);
  }

  pool.emitter.on('mtrl', (mtrl) => {
    mtrl.setImage(this.images[mtrl.name]);
    mtrl.createObjects(state);
  });

  pool.emitter.on('model', createObjects);
  pool.emitter.on('shader', createObjects);

  var modelPaths = this.options.modelPaths;
  var gradientImage = this.options.gradientImage;

  // Asset downloads.

  var fetchModel = async (modelName, modelPath) => {
    let sol;

    if (modelPath === 'parabola/test1') {
      sol = Solid.genTestMap();
    } else {
      sol = await data.fetchSol(modelPath);
    }

    if (modelName === 'gradient') {
      // Replace the first SOL material with a gradient image.
      sol.mv[0].f = gradientImage;
    }

    for (const solMtrl of sol.mv) {
      this.images[solMtrl.f] = await data.fetchImageForMtrl(solMtrl.f);
    }

    return sol;
  }

  for (const modelName in this.options.modelPaths) {
    const modelPath = modelPaths[modelName];

    fetchModel(modelName, modelPath).then(function (sol) {
      let model;

      if (modelName === 'gradient') {
        model = createGradientModel(pool, scene.entities, sol);
      } else if (modelName === 'background') {
        model = createBackgroundModel(pool, scene.entities, sol);
      } else {
        if (sol.dicts.drawback === '1') {
          for (var mi = 0, mc = sol.mtrls.length; mi < mc; ++mi) {
            sol.mtrls[mi].fl |= Solid.MTRL_TWO_SIDED_SEPARATE;
          }
        }
        pool.cacheSol(sol);
        model = SolidModel.fromSol(sol, scene.entities);

        if (modelName === 'level') {
          scene.fly(1.0);
        }
      }

      // TODO: this could be a separate step from downloading.

      scene.setModel(state, modelName, model);
    });
  }

  /**
   * Get time in seconds since last invocation.
   *
   * This is a closure so that multiple Parabola instances can animate simultaneously.
   */
  var getDeltaTime = (function () {
    var lastTime = 0.0;

    return function (currTime) {
      var dt = (currTime - lastTime) / 1000.0;

      if (dt > 1.0) {
        dt = 0.0;
      }

      lastTime = currTime;
      return dt;
    };
  })();

  /*
   * Basic requestAnimationFrame loop.
   */
  function processFrame(currTime) {
    animationRequestId = window.requestAnimationFrame(processFrame);

    var dt = getDeltaTime(currTime);

    if (dt < 1.0) {
      step(dt);
    }
  }

  animationRequestId = window.requestAnimationFrame(processFrame);

  var currWidth = 0;
  var currHeight = 0;

  function step(dt) {
    if (currWidth !== canvas.clientWidth || currHeight !== canvas.clientHeight) {
      var w = canvas.clientWidth;
      var h = canvas.clientHeight;

      // Update projection matrix with CSS dimensions.
      scene.view.setProjection(w, h, 50);

      // Resize drawing buffer to CSS dimensions.
      canvas.width = w;
      canvas.height = h;

      // Update viewport.
      gl.viewport(0, 0, w, h);

      // Save values.
      currWidth = w;
      currHeight = h;
    }

    scene.view.mouseLook(0, 0);
    scene.step(dt);
    scene.draw(state);
  }

  if (this.options.isInteractive) {
    function mouseMove(e) {
      scene.view.mouseLook(e.movementX, e.movementY);
    }

    function pointerLockChange(e) {
      if (document.pointerLockElement === canvas) {
        document.addEventListener('mousemove', mouseMove);

        window.addEventListener('keydown', keyDown);
        window.addEventListener('keyup', keyUp);
      } else {
        document.removeEventListener('mousemove', mouseMove);

        window.removeEventListener('keydown', keyDown);
        window.removeEventListener('keyup', keyUp);
      }
    }

    function togglePointerLock(e) {
      if (document.pointerLockElement) {
        document.exitPointerLock();
      } else {
        canvas.requestPointerLock();
      }
    }

    function keyDown(e) {
      var code = e.code; // Not very portable.

      if (code === 'KeyW') {
        scene.view.moveForward(true);
      } else if (code === 'KeyA') {
        scene.view.moveLeft(true);
      } else if (code === 'KeyS') {
        scene.view.moveBackward(true);
      } else if (code === 'KeyD') {
        scene.view.moveRight(true);
      }
    }

    function keyUp(e) {
      var code = e.code;

      if (code === 'KeyW') {
        scene.view.moveForward(false);
      } else if (code === 'KeyA') {
        scene.view.moveLeft(false);
      } else if (code === 'KeyS') {
        scene.view.moveBackward(false);
      } else if (code === 'KeyD') {
        scene.view.moveRight(false);
      }
    }

    canvas.addEventListener('click', togglePointerLock);
    document.addEventListener('pointerlockchange', pointerLockChange);

    canvas.addEventListener('wheel', function (e) {
      scene.view.setMoveSpeed(-Math.sign(e.deltaY));
      e.preventDefault();
    }, { passive: false });
  }

  if (this.options.hasOverlay) {
    if (canvas.parentElement) {
      const overlayElement = this.getOverlay();
      canvas.parentElement.appendChild(overlayElement);
    }
  }
}

/**
 * Build a document fragment with the Parabola overlay.
 * 
 * @returns {DocumentFragment}
 */
Parabola.prototype.getOverlay = function () {
  const state = this.state;
  const scene = this.scene;

  const fragment = document.createDocumentFragment();
  const overlayElement = document.createElement('div');

  // Get a unique element ID for label/input association.
  const overlayId = randomId();

  fragment.append(overlayElement);

  // Build the DOM.

  overlayElement.innerHTML = `
    <div class="parabola-overlay">
      <div class="parabola-controls">
        <strong>Click</strong> to grab pointer, <strong>WASD</strong> to fly around, <strong>mouse</strong> to look around, <strong>mouse wheel</strong> to change flying speed.
      </div>
      <div>
        <label for="toggle-textures-${overlayId}">Toggle textures</label>
        <input id="toggle-textures-${overlayId}" type="checkbox" ${this.state.enableTextures ? "checked" : ""}>
      </div>
      <div>
        <label for="max-batches-${overlayId}">Max batches</label>
        <input id="max-batches-${overlayId}" type="number" min="-1" step="1" value="-1">
      </div>
      <div>
        <label for="scene-time-${overlayId}">Scene time</label>
        <input id="scene-time-${overlayId}" type="number" min="-0.1" step="0.1" value="-0.1">
      </div>
      <div>
        <label for="flyby-${overlayId}">Fly-by</label>
        <input id="flyby-${overlayId}" type="range" min="-1" max="1" step="0.005" value="1">
      </div>
      <div>
        <span>GL context</span>
        <button type="button" id="lose-context-${overlayId}">Lose</button>
        <button type="button" id="restore-context-${overlayId}">Restore</button>
      </div>
    </div>
  `;

  // Setup event listeners.

  const toggleTexturesInput = fragment.getElementById('toggle-textures-' + overlayId);
  const maxBatchesInput = fragment.getElementById('max-batches-' + overlayId);
  const sceneTimeInput = fragment.getElementById('scene-time-' + overlayId);
  const flybyInput = fragment.getElementById('flyby-' + overlayId);
  const loseContextButton = fragment.getElementById('lose-context-' + overlayId);
  const restoreContextButton = fragment.getElementById('restore-context-' + overlayId);

  toggleTexturesInput.addEventListener('change', function (event) {
    state.enableTextures = this.checked;
  });

  maxBatchesInput.addEventListener('input', function (event) {
    scene._maxRenderedBatches = this.value;
    this.max = scene._batches.length;
  });

  sceneTimeInput.addEventListener('input', function (event) {
    scene.fixedTime = this.value;
  });

  flybyInput.addEventListener('input', function (event) {
    scene.fly(this.value);
  });

  loseContextButton.addEventListener('click', function (event) {
    state.loseContext.loseContext();
  });

  restoreContextButton.addEventListener('click', function (event) {
    state.loseContext.restoreContext();
  });

  return fragment;
}

/**
 * Create a SolidModel to serve as background gradient.
 *
 * This takes a 'map-back/back.sol' SOL file, inserts the
 * given gradient material/image into it, and sets up
 * an appropriate transform matrix.
 */
function createGradientModel(pool, entities, sol) {
  // Create the material object.
  var gradMtrl = Mtrl.fromSolMtrl(sol, 0);
  // Disable depth testing and depth writes on the material.
  gradMtrl.flagsPerPass[0] &= ~Mtrl.DEPTH_TEST;
  gradMtrl.flagsPerPass[0] &= ~Mtrl.DEPTH_WRITE;
  // Cache it manually to keep our flag changes from being overwritten.
  pool._cacheMtrl(gradMtrl);

  // Cache the rest of the resources.
  pool.cacheSol(sol);

  // Create a model.
  var model = SolidModel.fromSol(sol, entities);

  // Scale it.
  const BACK_DIST = 256.0;
  model.sceneNode.setLocalMatrix([0, 0, 0], [0, 0, 0, 1], [-BACK_DIST, BACK_DIST, -BACK_DIST]);

  // Set the sort layer for the entire model.
  model.setBatchSortLayer(Batch.LAYER_GRADIENT);

  return model;
};

/**
 * Mark all billboards as background billboards.
 */
function createBackgroundModel(pool, entities, sol) {
  for (var i = 0, n = sol.bills.length; i < n; ++i) {
    var bill = sol.bills[i];
    bill.fl |= Solid.BILL_BACK;
  }

  pool.cacheSol(sol);
  var model = SolidModel.fromSol(sol, entities);
  model.setBatchSortLayer(Batch.LAYER_BACKGROUND);
  return model;
}

/**
 * Get a random number between the given values.
 * 
 * @param {number} a lower bound
 * @param {number} b upper bound
 * @returns {number}
 */
function randomBetween(a, b) {
  return a + (b - a) * Math.random();
}

/**
 * Get a random printable ASCII character.
 * 
 * @returns 
 */
function randomPrintable() {
  return String.fromCodePoint(Math.floor(randomBetween(32, 122)));
}

/**
 * Get a random string of given length.
 * 
 * @param {number} length 
 * @returns 
 */
function randomString(length) {
  var str = '';

  for (var i = 0; i < length; ++i) {
    str += randomPrintable();
  }

  return str;
}

/**
 * Get a random unused element ID.
 * 
 * @returns {string}
 */
function randomId() {
  do {
    var id = randomString(16).replace(/[^a-zA-Z]/g, '');
    // Length check ensures we have at least that many printable characters.
  } while (id.length < 8 || document.getElementById(id) !== null);

  return id;
}