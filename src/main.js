'use strict';

var Parabola = module.exports = {};

var screenfull = require('screenfull');
var data = require('./data.js');

var GLState = require('./gl-state.js');
var GLPool = require('./gl-pool.js');
var Scene = require('./scene.js');
var SolidModel = require('./solid-model.js');
var Mtrl = require('./mtrl.js');
var Mesh = require('./mesh.js');
var Solid = require('./solid.js');

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

/**
 * Create a SolidModel to serve as background gradient.
 *
 * This takes a 'map-back/back.sol' SOL file, inserts the
 * given gradient material/image into it, and sets up
 * an appropriate transform matrix.
 */
Parabola.createGradientModel = function (pool, entities, sol) {
  // Create the material object.
  var gradMtrl = Mtrl.fromSolMtrl(sol, 0);
  // Disable depth testing and depth writes on the material.
  gradMtrl.flags &= ~Mtrl.DEPTH_TEST;
  gradMtrl.flags &= ~Mtrl.DEPTH_WRITE;
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
  model.setMeshSortLayer(Mesh.LAYER_GRADIENT);

  return model;
};

/**
 * Mark all billboards as background billboards.
 */
Parabola.createBackgroundModel = function (pool, entities, sol) {
  for (var i = 0, n = sol.bills.length; i < n; ++i) {
    var bill = sol.bills[i];
    bill.fl |= Solid.BILL_BACK;
  }

  pool.cacheSol(sol);
  var model = SolidModel.fromSol(sol, entities);
  model.setMeshSortLayer(Mesh.LAYER_BACKGROUND);
  return model;
}

Parabola.BACKGROUNDS = [
  { sol: 'map-back/alien.sol', gradient: 'back/alien' },
  // { sol: 'map-back/city.sol', gradient: 'back/city' },
  // { sol: 'map-back/clouds.sol', gradient: 'back/land' },
  // { sol: 'map-back/jupiter.sol', gradient: 'back/space' },
  // { sol: 'map-back/ocean.sol', gradient: 'back/ocean' },
  // { sol: 'map-back/volcano.sol', gradient: 'back/volcano' }
];

function init() {
  var canvas = document.getElementById('canvas');
  var state = GLState(canvas);
  var pool = GLPool();
  var scene = Scene();
  var gl = state.gl;
  var solFile = null;

  var background = Parabola.BACKGROUNDS[Math.floor(Math.random() * (Parabola.BACKGROUNDS.length))];

  function createObjects(res) {
    res.createObjects(state);
  }

  pool.emitter.on('mtrl', createObjects);
  pool.emitter.on('model', createObjects);
  pool.emitter.on('shader', createObjects);

  data.fetchSol('geom/back/back.sol')
    .then(function (sol) {
      // Replace the first SOL material with a gradient image.
      sol.mv[0].f = background.gradient;
      return sol;
    })
    .then(function (sol) {
      var model = Parabola.createGradientModel(pool, scene.entities, sol);
      scene.setModel(state, 'gradient', model);
      return model;
    });

  data.fetchSol(background.sol)
    .then(function (sol) {
      var model = Parabola.createBackgroundModel(pool, scene.entities, sol);
      scene.setModel(state, 'background', model);
      return model;
    });

  var modelPaths = {
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
  };

  for (let modelName in modelPaths) {
    data.fetchSol(modelPaths[modelName])
      .then(function (sol) {
        pool.cacheSol(sol);
        var model = SolidModel.fromSol(sol, scene.entities);
        scene.setModel(state, modelName, model);
        return model;
      });
  }

  /*
   * Basic requestAnimationFrame loop.
   */
  function animationFrame(currTime) {
    window.requestAnimationFrame(animationFrame);

    var dt = getDeltaTime(currTime);

    if (dt < 1.0) {
      step(dt);
    }
  }
  window.requestAnimationFrame(animationFrame);

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

  var modelListElem = document.getElementById('model-list');

  scene.emitter.on('model-added', function (model) {
    var li = document.createElement('li');

    li.textContent = model.id;
    li.dataset.modelId = model.id;

    modelListElem.appendChild(li);
  });

  scene.emitter.on('model-assigned', function (slotName, model) {
    for (var i = 0, n = modelListElem.children.length; i < n; ++i) {
      var li = modelListElem.children[i];

      if (model) {
        if (li.dataset.modelId === model.id) {
          li.dataset.slotName = slotName;
          li.textContent += ' (' + slotName + ')';
          break;
        }
      } else {
        if (li.dataset.slotName === slotName) {
          li.textContent = li.textContent.replace(' (' + slotName + ')', '');
          break;
        }
      }
    }
  });

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

  canvas.addEventListener('click', togglePointerLock);
  document.addEventListener('pointerlockchange', pointerLockChange);

  var setViewPositionInput = document.getElementById('set-view-position');

  if (setViewPositionInput) {
    setViewPositionInput.addEventListener('input', function () {
      if (solFile) {
        scene.view.setFromSol(solFile, this.value);
      }
    });
  }

  var toggleFullscreenInput = document.getElementById('toggle-fullscreen');

  if (toggleFullscreenInput) {
    toggleFullscreenInput.addEventListener('change', function () {
      if (screenfull.enabled) {
        screenfull.toggle(document.getElementById('main'));
      }
    });
  }

  if (screenfull.enabled) {
    screenfull.on('change', function () {
      if (toggleFullscreenInput) {
        toggleFullscreenInput.checked = screenfull.isFullscreen;
      }
      if (screenfull.isFullscreen) {
        // TODO add body class
      } else {
        // TODO remove body class
      }
    });
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

  canvas.addEventListener('wheel', function (e) {
    scene.view.setMoveSpeed(-Math.sign(e.deltaY));
    e.preventDefault();
  }, { passive: false });

  var toggleTexturesInput = document.getElementById('toggle-textures');

  if (toggleTexturesInput) {
    toggleTexturesInput.addEventListener('change', function (e) {
      state.enableTextures = this.checked;
    });
  }
}

init();
