'use strict';

var vec3 = require('gl-matrix').vec3;
var quat = require('gl-matrix').quat;
var mat4 = require('gl-matrix').mat4;

var toRadian = require('gl-matrix').glMatrix.toRadian;
var nanoECS = require('nano-ecs');

var Mtrl = require('./mtrl.js');
var Mover = require('./mover.js');
var BodyModel = require('./body-model.js');
var Solid = require('./solid.js');

function SolidModel() {
  var model = Object.create(SolidModel.prototype);

  model.entities = null;
  model.models = null;
  model.materials = null;

  // Transparency defaults. Overridden by ball skins, primarily.

  model.transparentDepthTest = true;
  model.transparentDepthMask = false;

  return model;
}

/*
 * Entity components.
 */
function Drawable() {
  this.model = null;
}

function Spatial() {
  this.matrix = mat4.create();

  this.position = vec3.create()
  this.orientation = quat.create();
  this.scale = 1;
}

Spatial.prototype.updateMatrix = (function () {
  var s = vec3.create();

  return function() {
    var p = this.position;
    var e = this.orientation;

    vec3.set(s, this.scale, this.scale, this.scale);

    mat4.fromRotationTranslationScale(this.matrix, e, p, s);
  }
})();

function Movers() {
  this.translate = null;
  this.rotate = null;
}

function Item() {
  this.value = 0;
}

function Billboard() {
  this.mtrl = null;

  this.time = 1.0;
  this.dist = 0.0;

  this.w = vec3.create();
  this.h = vec3.create();

  this.rx = vec3.create();
  this.ry = vec3.create();
  this.rz = vec3.create();

  this.flags = 0;
}

Billboard.prototype.fromSolBill = function (sol, solBill) {
  this.mtrl = sol.mv[solBill.mi];

  this.time = solBill.t;
  this.dist = solBill.d;

  this.w = solBill.w;
  this.h = solBill.h;

  this.rx = solBill.rx;
  this.ry = solBill.ry;
  this.rz = solBill.rz;

  this.flags = solBill.fl;
}

Billboard.prototype.getForegroundTransform = function(M, globalTime) {
  // sol_bill

  var T = this.time * globalTime;
  var S = Math.sin(T);

  var w = this.w[0] + this.w[1] * T + this.w[2] * S;
  var h = this.h[0] + this.h[1] * T + this.h[2] * S;

  var rx = this.rx[0] + this.rx[1] * T + this.rx[2] * S;
  var ry = this.ry[0] + this.ry[1] * T + this.ry[2] * S;
  var rz = this.rz[0] + this.rz[1] * T + this.rz[2] * S;

  // Preserve passed transform.
  //mat4.identity(M);

  // TODO multiply by view basis.
  // or... can be done by the caller.

  if (rx) mat4.rotateX(M, M, rx / 180.0 * Math.PI);
  if (ry) mat4.rotateY(M, M, ry / 180.0 * Math.PI);
  if (rz) mat4.rotateZ(M, M, rz / 180.0 * Math.PI);

  mat4.scale(M, M, [w, h, 1.0]);

  return M;
}

Billboard.prototype.getBackgroundTransform = function (M, globalTime) {
  var T = this.time > 0 ? globalTime % this.time - this.time / 2 : 0;

  var w = this.w[0] + this.w[1] * T + this.w[2] * T * T;
  var h = this.h[0] + this.h[1] * T + this.h[2] * T * T;

  // TODO Render only billboards facing the viewer.

  if (w > 0 && h > 0) {
    var rx = this.rx[0] + this.rx[1] * T + this.rx[2] * T * T;
    var ry = this.ry[0] + this.ry[1] * T + this.ry[2] * T * T;
    var rz = this.rz[0] + this.rz[1] * T + this.rz[2] * T * T;

    if (ry) mat4.rotateY(M, M, toRadian(ry));
    if (rx) mat4.rotateX(M, M, toRadian(rx));

    mat4.translate(M, M, [0, 0, -this.dist]);

    if (this.flags & Solid.BILL_FLAT) {
      mat4.rotateX(M, M, toRadian(-rx - 90));
      mat4.rotateZ(M, M, toRadian(-ry));
    }

    if (this.flags & Solid.BILL_EDGE) {
      mat4.rotateX(M, M, toRadian(-rx));
    }

    if (rz) mat4.rotateZ(M, M, toRadian(rz))

    mat4.scale(M, M, [w, h, 1.0]);
  }

  return M;
}

/*
 * Load entities from SOL.
 */
SolidModel.fromSol = function(sol) {
  var solidModel = SolidModel();

  var ents = solidModel.entities = nanoECS();
  var models = solidModel.models = [];
  var materials = solidModel.materials = {};

  // Materials

  for (var i = 0; i < sol.mv.length; ++i) {
    var mtrl = sol.mv[i];
    materials[mtrl.f] = mtrl;
  }

  // Bodies

  for (var i = 0; i < sol.bv.length; ++i) {
    var solBody = sol.bv[i];
    var ent = ents.createEntity().addTag('body');

    ent.addComponent(Drawable);
    ent.addComponent(Spatial);
    ent.addComponent(Movers);

    var model = BodyModel.fromSolBody(sol, solBody);
    ent.drawable.model = model;
    models.push(model);

    // TODO should movers be entities?
    var movers = Mover.fromSolBody(sol, solBody);
    ent.movers.translate = movers.translate;
    ent.movers.rotate = movers.rotate;
  }

  // Items

  for (var i = 0; i < sol.hv.length; ++i) {
    var solItem = sol.hv[i];

    var ent = ents.createEntity().addTag('item');

    if (solItem.t === Solid.ITEM_GROW) {
      ent.addTag('grow');
    } else if (solItem.t === Solid.ITEM_SHRINK) {
      ent.addTag('shrink');
    } else if (solItem.t === Solid.ITEM_COIN) {
      if (solItem.n >= 10) {
        ent.addTag('coin10');
      } else if (solItem.n >= 5) {
        ent.addTag('coin5');
      } else {
        ent.addTag('coin');
      }
    } else {
      ent.remove();
      continue;
    }

    ent.addComponent(Item);
    ent.addComponent(Spatial);

    ent.item.value = solItem.n;

    vec3.copy(ent.spatial.position, solItem.p);
    ent.spatial.scale = 0.15; // Neverball default.
    ent.spatial.updateMatrix();
  }

  // Balls

  for (var i = 0; i < sol.uv.length; ++i) {
    var solBall = sol.uv[i];
    var ent = ents.createEntity().addTag('ball');

    ent.addComponent(Spatial);

    ent.spatial.scale = solBall.r;
    vec3.copy(ent.spatial.position, solBall.p);
    ent.spatial.updateMatrix();
  }

  // Billboards

  for (var i = 0; i < sol.rv.length; ++i) {
    var solBill = sol.rv[i];
    var ent = ents.createEntity().addTag('billboard');

    ent.addComponent(Spatial);
    ent.addComponent(Billboard);

    vec3.copy(ent.spatial.position, solBill.p);
    ent.spatial.updateMatrix();

    ent.billboard.fromSolBill(sol, solBill);
  }

  return solidModel;
}

SolidModel.prototype.step = function(dt) {
  var ents = this.entities.queryComponents([Spatial, Movers]);

  for (var i = 0; i < ents.length; ++i) {
    var ent = ents[i];

    // Update movers.

    var moverTranslate = ent.movers.translate;
    var moverRotate = ent.movers.rotate;

    if (moverTranslate === moverRotate) {
      moverTranslate.step(dt);
    } else {
      moverTranslate.step(dt);
      moverRotate.step(dt);
    }

    // Update model matrix.

    // TODO do this only on actual update
    moverTranslate.getPosition(ent.spatial.position);
    moverRotate.getOrientation(ent.spatial.orientation);

    ent.spatial.updateMatrix();
  }
}

/*
 * Create body mesh VBOs and textures.
 */
SolidModel.prototype.createObjects = function(gl) {
  var models = this.models;
  var materials = this.materials;

  for (var i = 0; i < models.length; ++i) {
    var model = models[i];
    if (model) {
      model.createObjects(gl);
    }
  }

  for (var mtrlName in materials) {
    Mtrl.loadTexture(gl, materials[mtrlName]);
  }
}

/*
 * Render entity meshes of the given type. Pass a parentMatrix for hierarchical transform.
 */
SolidModel.prototype.drawMeshType = function(gl, state, meshType, parentMatrix) {
  var ents = this.entities.queryComponents([Drawable, Spatial]);

  for (var i = 0; i < ents.length; ++i) {
    var ent = ents[i];
    var model = ent.drawable.model;

    if (parentMatrix) {
      // TODO move this off the render path.
      var modelMatrix = mat4.create();
      mat4.multiply(modelMatrix, parentMatrix, ent.spatial.matrix);
      // TODO update uniforms on actual change
      gl.uniformMatrix4fv(state.uModelID, false, modelMatrix);
    } else {
      gl.uniformMatrix4fv(state.uModelID, false, ent.spatial.matrix);;
    }

    // TODO tag entities w/ models that have this mesh type?
    // Iterate over tagged lists?
    model.drawMeshType(gl, state, meshType);
  }
}

/*
 * Render model meshes. Pass a parentMatrix for hierarchical transform.
 */
SolidModel.prototype.drawBodies = function(gl, state, parentMatrix) {
  // sol_draw()

  const mask = this.transparentDepthMask;
  const test = this.transparentDepthTest;

  // TODO mirrors
  this.drawMeshType(gl, state, 'reflective', parentMatrix);

  this.drawMeshType(gl, state, 'opaque', parentMatrix);
  this.drawMeshType(gl, state, 'opaqueDecal', parentMatrix);

  if (!test) gl.disable(gl.DEPTH_TEST);
  if (!mask) gl.depthMask(false);
  {
    this.drawMeshType(gl, state, 'transparentDecal', parentMatrix);
    this.drawMeshType(gl, state, 'transparent', parentMatrix);
  }
  if (!mask) gl.depthMask(true);
  if (!test) gl.enable(gl.DEPTH_TEST);
}

/*
 * Alias.
 */
SolidModel.prototype.draw = SolidModel.prototype.drawBodies;

/*
 * Render item entities with a pre-loaded model.
 */
SolidModel.prototype.drawItems = function(gl, state) {
  var modelsByTag = {
    coin: state.models.coin,
    coin5: state.models.coin5,
    coin10: state.models.coin10,
    grow: state.models.grow,
    shrink: state.models.shrink
  };

  for (var tag in modelsByTag) {
    var model = modelsByTag[tag];

    if (model) {
      var ents = this.entities.queryTag(tag);

      for (var i = 0; i < ents.length; ++i) {
        model.draw(gl, state, ents[i].spatial.matrix);
      }
    }
  }
}

/*
 * Render ball entities with a pre-loaded model.
 */
SolidModel.prototype.drawBalls = function(gl, state) {
  var model = state.models.ball;

  if (model) {
    var ents = this.entities.queryTag('ball');

    for (var i = 0; i < ents.length; ++i) {
      var ent = ents[i];

      model.draw(gl, state, ent.spatial.matrix);
    }
  }
}

SolidModel.prototype.drawBills = function(gl, state, parentMatrix) {
  var ents = this.entities.queryComponents([Billboard, Spatial]);

  // TODO
  var viewBasis = state.view.getBasis();
  var modelMatrix = mat4.create();

  state.billboardMesh.enableDraw(gl, state);

  const test = this.transparentDepthTest;
  const mask = this.transparentDepthMask;

  if (!test) gl.disable(gl.DEPTH_TEST);
  if (!mask) gl.depthMask(false);

  for (var i = 0; i < ents.length; ++i) {
    var ent = ents[i];

    // TODO too much math for a draw frame
    // if (!B_NOFACE)
    mat4.multiply(modelMatrix, ent.spatial.matrix, viewBasis);
    ent.billboard.getForegroundTransform(modelMatrix, state.time);

    if (parentMatrix) {
      mat4.multiply(modelMatrix, parentMatrix, modelMatrix);
    }
    gl.uniformMatrix4fv(state.uModelID, false, modelMatrix);

    Mtrl.draw(gl, state, ent.billboard.mtrl);
    state.billboardMesh.draw(gl, state);
  }

  if (!mask) gl.depthMask(true);
  if (!test) gl.enable(gl.DEPTH_TEST);

  state.billboardMesh.disableDraw(gl, state);
}

module.exports = SolidModel;
