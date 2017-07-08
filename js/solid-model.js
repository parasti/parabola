'use strict';

var vec3 = require('gl-matrix').vec3;
var quat = require('gl-matrix').quat;
var mat4 = require('gl-matrix').mat4;

var nanoECS = require('nano-ecs');

var Mtrl = require('./mtrl.js');
var Mover = require('./mover.js');
var BodyModel = require('./body-model.js');

function SolidModel(gl, sol) {
  this.entities = null;

  if (sol && gl) {
    this.fromSol(sol);
    this.createObjects(gl);
  }
}

/*
 * Load body meshes and initial transform from SOL.
 */

/*
 * Thoughts on nano-ecs so far:
 * Use of "new" prevents factory functions for components.
 * Can't namespace components? typedef.getName returns empty for methods.
 */

/*
 * Entity components
 */
function Drawable() {
  this.model = null;
}

function Spatial() {
  this.position = vec3.create()
  this.orientation = quat.create();
  this.scale = 1.0;
  this.modelMatrix = mat4.create();
}

function Movers() {
  this.translate = null;
  this.rotate = null;
}

function Item() {
  this.value = 0;
}

SolidModel.prototype.fromSol = function(sol) {

  var ents = this.entities = nanoECS();

  // Bodies
  for (var i = 0; i < sol.bv.length; ++i) {
    var solBody = sol.bv[i];
    var ent = ents.createEntity().addTag('body');

    ent.addComponent(Drawable);
    ent.addComponent(Spatial);
    ent.addComponent(Movers);

    ent.drawable.model = BodyModel.fromSolBody(sol, solBody);        

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

    ent.item.value = solItem.n;

    ent.addComponent(Spatial);

    // GLMatrix doesn't have a mat4.fromTranslationScale.

    const r = 0.15; // Neverball default.
    const x = solItem.p[0];
    const y = solItem.p[1];
    const z = solItem.p[2];

    ent.spatial.scale = r;

    vec3.set(ent.spatial.position, x, y, z);

    mat4.set(ent.spatial.modelMatrix,
      r, 0, 0, 0, // column 0
      0, r, 0, 0, // column 1
      0, 0, r, 0, // column 2
      x, y, z, 1  // column 3
    );
  }

  for (var i = 0; i < sol.uv.length; ++i) {
    var solBall = sol.uv[i];
    var ent = ents.createEntity().addTag('ball');

    ent.addComponent(Spatial);

    const r = solBall.r;
    const x = solBall.p[0];
    const y = solBall.p[1];
    const z = solBall.p[2];

    ent.spatial.scale = r;

    vec3.set(ent.spatial.position, x, y, z);

    mat4.set(ent.spatial.modelMatrix,
      r, 0, 0, 0, // column 0
      0, r, 0, 0, // column 1
      0, 0, r, 0, // column 2
      x, y, z, 1  // column 3
    );
  }
}

SolidModel.prototype.step = function(dt) {
  var ents = this.entities.queryComponents([Spatial, Movers]);

  for (var i = 0; i < ents.length; ++i) {
    var ent = ents[i];

    var moverTranslate = ent.movers.translate;
    var moverRotate = ent.movers.rotate;

    var p = ent.spatial.position;
    var e = ent.spatial.orientation;

    if (moverTranslate === moverRotate) {
      moverTranslate.step(dt);
    } else {
      moverTranslate.step(dt);
      moverRotate.step(dt);
    }

    // TODO do this only on actual update
    moverTranslate.getPosition(p);
    moverRotate.getOrientation(e);

    mat4.fromRotationTranslation(ent.spatial.modelMatrix, e, p);
  }
}

/*
 * Create body mesh VBOs and textures.
 */
SolidModel.prototype.createObjects = function(gl) {
  var ents = this.entities.queryComponents([Drawable]);

  for (var i = 0; i < ents.length; ++i) {
    var model = ents[i].drawable.model;
    if (model) {
      model.createObjects(gl);
    }
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

    if (model) {
      if (parentMatrix) {
        var modelMatrix = mat4.create(); // TODO move this off the render path
        mat4.multiply(modelMatrix, parentMatrix, ent.spatial.modelMatrix);
        // TODO update uniforms on actual change
        gl.uniformMatrix4fv(state.uModelID, false, modelMatrix);
      } else {
        gl.uniformMatrix4fv(state.uModelID, false, ent.spatial.modelMatrix);
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

/*
 * Render item entities with a pre-loaded model.
 */
SolidModel.prototype.drawItems = function(gl, state) {
  var ents = this.entities.queryTag('item');

  for (var i = 0; i < ents.length; ++i) {
    var ent = ents[i];

    // Pass entity transform as a parent matrix for nested SolidModel rendering.
    if (ent.hasTag('grow')) {
      state.growModel.drawBodies(gl, state, ent.spatial.modelMatrix);
    } else if (ent.hasTag('shrink')) {
      state.shrinkModel.drawBodies(gl, state, ent.spatial.modelMatrix);
    } else {
      state.coinModel.drawBodies(gl, state, ent.spatial.modelMatrix);
    }
  }
}

SolidModel.prototype.drawBalls = function(gl, state) {
  var ents = this.entities.queryTag('ball');

  for (var i = 0; i < ents.length; ++i) {
    var ent = ents[i];

    state.ballModel.draw(gl, state, ent.spatial.modelMatrix);
  }
}

module.exports = SolidModel;