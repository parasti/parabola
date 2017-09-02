'use strict';

var vec3 = require('gl-matrix').vec3;
var mat4 = require('gl-matrix').mat4;

var nanoECS = require('nano-ecs');

var Mtrl = require('./mtrl.js');
var Mover = require('./mover.js');
var BodyModel = require('./body-model.js');
var Solid = require('./solid.js');
var Shader = require('./shader.js');
var EC = require('./entity-components.js');

function SolidModel () {
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
 * Load entities from SOL.
 */
SolidModel.fromSol = function (sol) {
  var solidModel = SolidModel();

  var ents = solidModel.entities = nanoECS();
  var models = solidModel.models = [];
  var materials = solidModel.materials = [];

  var i, ent;

  // Materials

  for (i = 0; i < sol.mv.length; ++i) {
    var mtrl = sol.mv[i];
    materials.push(mtrl);

    // TODO
    Shader(mtrl);
  }

  // Bodies

  for (i = 0; i < sol.bv.length; ++i) {
    var solBody = sol.bv[i];

    ent = ents.createEntity().addTag('body');

    ent.addComponent(EC.Drawable);
    ent.addComponent(EC.Spatial);
    ent.addComponent(EC.Movers);

    var model = BodyModel.fromSolBody(sol, solBody);
    ent.drawable.model = model;
    models.push(model);

    // TODO should movers be entities?
    var movers = Mover.fromSolBody(sol, solBody);
    ent.movers.translate = movers.translate;
    ent.movers.rotate = movers.rotate;
  }

  // Items

  for (i = 0; i < sol.hv.length; ++i) {
    var solItem = sol.hv[i];

    ent = ents.createEntity().addTag('item');

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

    ent.addComponent(EC.Item);
    ent.addComponent(EC.Spatial);

    ent.item.value = solItem.n;

    vec3.copy(ent.spatial.position, solItem.p);
    ent.spatial.scale = 0.15; // Neverball default.
    ent.spatial.updateMatrix();
  }

  // Balls

  for (i = 0; i < sol.uv.length; ++i) {
    var solBall = sol.uv[i];

    ent = ents.createEntity().addTag('ball');

    ent.addComponent(EC.Spatial);

    ent.spatial.scale = solBall.r;
    vec3.copy(ent.spatial.position, solBall.p);
    ent.spatial.updateMatrix();
  }

  // Billboards

  for (i = 0; i < sol.rv.length; ++i) {
    var solBill = sol.rv[i];

    ent = ents.createEntity().addTag('billboard');

    ent.addComponent(EC.Spatial);
    ent.addComponent(EC.Billboard);

    vec3.copy(ent.spatial.position, solBill.p);
    ent.spatial.updateMatrix();

    ent.billboard.fromSolBill(sol, solBill);
  }

  return solidModel;
};

SolidModel.prototype.step = function (dt) {
  var ents = this.entities.queryComponents([EC.Spatial, EC.Movers]);

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
};

/*
 * Create body mesh VBOs and textures.
 */
SolidModel.prototype.createObjects = function (gl) {
  var models = this.models;
  var materials = this.materials;
  var i;

  for (i = 0; i < models.length; ++i) {
    var model = models[i];
    if (model) {
      model.createObjects(gl);
    }
  }

  for (i = 0; i < materials.length; ++i) {
    Mtrl.loadTexture(gl, materials[i]);
  }
};

/*
 * Render entity meshes of the given type. Pass a parentMatrix for hierarchical transform.
 */
SolidModel.prototype.drawMeshType = function (gl, state, meshType, parentMatrix) {
  var ents = this.entities.queryComponents([EC.Drawable, EC.Spatial]);

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
      gl.uniformMatrix4fv(state.uModelID, false, ent.spatial.matrix);
    }

    // TODO tag entities w/ models that have this mesh type?
    // Iterate over tagged lists?
    model.drawMeshType(gl, state, meshType);
  }
};

/*
 * Render model meshes. Pass a parentMatrix for hierarchical transform.
 */
SolidModel.prototype.drawBodies = function (gl, state, parentMatrix) {
  // sol_draw()

  const mask = this.transparentDepthMask;
  const test = this.transparentDepthTest;

  // TODO mirrors
  this.drawMeshType(gl, state, 'reflective', parentMatrix);

  this.drawMeshType(gl, state, 'opaque', parentMatrix);
  this.drawMeshType(gl, state, 'opaqueDecal', parentMatrix);

  if (!test) gl.disable(gl.DEPTH_TEST);
  if (!mask) gl.depthMask(false);

  this.drawMeshType(gl, state, 'transparentDecal', parentMatrix);
  this.drawMeshType(gl, state, 'transparent', parentMatrix);

  if (!mask) gl.depthMask(true);
  if (!test) gl.enable(gl.DEPTH_TEST);
};

/*
 * Alias.
 */
SolidModel.prototype.draw = SolidModel.prototype.drawBodies;

/*
 * Render item entities with a pre-loaded model.
 */
SolidModel.prototype.drawItems = function (gl, state) {
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
};

/*
 * Render ball entities with a pre-loaded model.
 */
SolidModel.prototype.drawBalls = function (gl, state) {
  var model = state.models.ball;

  if (model) {
    var ents = this.entities.queryTag('ball');

    for (var i = 0; i < ents.length; ++i) {
      var ent = ents[i];

      model.draw(gl, state, ent.spatial.matrix);
    }
  }
};

SolidModel.prototype.drawBills = function (gl, state, parentMatrix) {
  var ents = this.entities.queryComponents([EC.Billboard, EC.Spatial]);

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
};

module.exports = SolidModel;
