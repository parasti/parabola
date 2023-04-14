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

  this.options.modelPaths = Object.assign(
    Object.create(null),
    Parabola.defaultOptions.modelPaths,
    options.modelPaths || null
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
    window.requestAnimationFrame(processFrame);

    var dt = getDeltaTime(currTime);

    if (dt < 1.0) {
      step(dt);
    }
  }

  window.requestAnimationFrame(processFrame);

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