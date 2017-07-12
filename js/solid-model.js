'use strict';

var vec3 = require('gl-matrix').vec3;
var quat = require('gl-matrix').quat;
var mat4 = require('gl-matrix').mat4;

var nanoECS = require('nano-ecs');

var Mtrl = require('./mtrl.js');
var Mover = require('./mover.js');
var BodyModel = require('./body-model.js');

function SolidModel() {
  this.entities = null;
  this.models = null;
}

/*
 * Notes on nano-ecs:
 *
 * 1) Use of "new" prevents factory functions for components.
 *    Workaround: return object from component to override 'new'.
 *    Can't return null or basic types this way, only objects.
 *
 * 2) Can't namespace components. typedef.getName returns empty for methods.
 *    Workaround (or intended): name your anonymous function.
 *      Components.whatever = function thing() { } // nano-ecs uses 'thing'
 *      e.addComponent(Components.whatever)
 */

/*
 * Entity components
 */
function Drawable() {
  this.model = null;
}

function ModelMatrix() {
  // Override 'new'.
  return mat4.create();
}

function Spatial() {
  this.position = vec3.create()
  this.orientation = quat.create();
  this.scale = 1.0;
}

function Movers() {
  this.translate = null;
  this.rotate = null;
}

function Item() {
  this.value = 0;
}

function Billboard() {
  this.mtrl = null; // TODO

  // Neverball defaults.
  this.time = 1.0;

  this.width = vec3.create();
  this.height = vec3.create();

  this.rotX = vec3.create();
  this.rotY = vec3.create();
  this.rotZ = vec3.create();

  this.flags = 0;
}

/*
 * Load entities from SOL.
 */
SolidModel.fromSol = function(sol) {
  var solidModel = new SolidModel();

  var ents = solidModel.entities = nanoECS();
  var models = solidModel.models = [];

  // Bodies

  for (var i = 0; i < sol.bv.length; ++i) {
    var solBody = sol.bv[i];
    var ent = ents.createEntity().addTag('body');

    ent.addComponent(Drawable);
    ent.addComponent(ModelMatrix);
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

  // Neverball item type to string.
  var itemTags = [null, 'coin', 'grow', 'shrink'];

  for (var i = 0; i < sol.hv.length; ++i) {
    var solItem = sol.hv[i];

    // Skip items we don't know about.
    if (!itemTags[solItem.t])
      continue;

    var ent = ents.createEntity().addTag('item').addTag(itemTags[solItem.t]);

    ent.addComponent(Item);
    ent.addComponent(Spatial);
    ent.addComponent(ModelMatrix);

    ent.item.value = solItem.n;

    // GLMatrix doesn't have a mat4.fromTranslationScale.

    const r = 0.15; // Neverball default.
    const x = solItem.p[0];
    const y = solItem.p[1];
    const z = solItem.p[2];

    ent.spatial.scale = r;

    vec3.set(ent.spatial.position, x, y, z);

    mat4.set(ent.modelMatrix,
      r, 0, 0, 0, // column 0
      0, r, 0, 0, // column 1
      0, 0, r, 0, // column 2
      x, y, z, 1  // column 3
    );
  }

  // Balls

  for (var i = 0; i < sol.uv.length; ++i) {
    var solBall = sol.uv[i];
    var ent = ents.createEntity().addTag('ball');

    ent.addComponent(Spatial);
    ent.addComponent(ModelMatrix);

    const r = solBall.r;
    const x = solBall.p[0];
    const y = solBall.p[1];
    const z = solBall.p[2];

    ent.spatial.scale = r;

    vec3.set(ent.spatial.position, x, y, z);

    mat4.set(ent.modelMatrix,
      r, 0, 0, 0, // column 0
      0, r, 0, 0, // column 1
      0, 0, r, 0, // column 2
      x, y, z, 1  // column 3
    );
  }

  // Billboards

  for (var i = 0; i < sol.rv.length; ++i) {
    var solBill = sol.rv[i];
    var ent = ents.createEntity().addTag('billboard');

    ent.addComponent(Billboard);
  }

  return solidModel;
}

SolidModel.prototype.step = function(dt) {
  var ents = this.entities.queryComponents([Spatial, ModelMatrix, Movers]);

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

    var p = ent.spatial.position;
    var e = ent.spatial.orientation;

    // Update model matrix.

    // TODO do this only on actual update
    moverTranslate.getPosition(p);
    moverRotate.getOrientation(e);

    mat4.fromRotationTranslation(ent.modelMatrix, e, p);
  }
}

/*
 * Create body mesh VBOs and textures.
 */
SolidModel.prototype.createObjects = function(gl) {
  var models = this.models;

  for (var i = 0; i < models.length; ++i) {
    var model = models[i];
    if (model) {
      model.createObjects(gl);
    }
  }
}

/*
 * Render entity meshes of the given type. Pass a parentMatrix for hierarchical transform.
 */
SolidModel.prototype.drawMeshType = function(gl, state, meshType, parentMatrix) {
  var ents = this.entities.queryComponents([Drawable, ModelMatrix]);

  for (var i = 0; i < ents.length; ++i) {
    var ent = ents[i];
    var model = ent.drawable.model;

    if (model) {
      if (parentMatrix) {
        var modelMatrix = mat4.create(); // TODO move this off the render path
        mat4.multiply(modelMatrix, parentMatrix, ent.modelMatrix);
        // TODO update uniforms on actual change
        gl.uniformMatrix4fv(state.uModelID, false, modelMatrix);
      } else {
        gl.uniformMatrix4fv(state.uModelID, false, ent.modelMatrix);
      }

      model.drawMeshType(gl, state, meshType);
    }
  }
}

/*
 * Transparency hacks. These are the defaults, to be overriden per model.
 */
SolidModel.prototype.transparentDepthTest = true;
SolidModel.prototype.transparentDepthMask = false;

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

// Synonym.
SolidModel.prototype.draw = SolidModel.prototype.drawBodies;

/*
 * Render item entities with a pre-loaded model.
 */
SolidModel.prototype.drawItems = function(gl, state) {
  var ents = this.entities.queryComponents([Item, ModelMatrix]);

  for (var i = 0; i < ents.length; ++i) {
    var ent = ents[i];

    // Pass entity transform as a parent matrix for nested SolidModel rendering.
    if (ent.hasTag('grow')) {
      state.growModel.draw(gl, state, ent.modelMatrix);
    } else if (ent.hasTag('shrink')) {
      state.shrinkModel.draw(gl, state, ent.modelMatrix);
    } else {
      if (ent.item.value >= 10) {
        state.coin10Model.draw(gl, state, ent.modelMatrix);
      } else if (ent.item.value >= 5) {
        state.coin5Model.draw(gl, state, ent.modelMatrix);
      } else {
        state.coinModel.draw(gl, state, ent.modelMatrix);
      }
    }
  }
}

/*
 * Render ball entities with a pre-loaded model.
 */
SolidModel.prototype.drawBalls = function(gl, state) {
  var ents = this.entities.queryTag('ball');

  for (var i = 0; i < ents.length; ++i) {
    var ent = ents[i];

    state.ballModel.draw(gl, state, ent.modelMatrix);
  }
}

SolidModel.prototype.drawBills = function(gl, state) {
  var ents = this.entities.queryComponents([Billboard]);
}

module.exports = SolidModel;
