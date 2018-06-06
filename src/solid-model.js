'use strict';

var vec3 = require('gl-matrix').vec3;
var mat3 = require('gl-matrix').mat3;
var mat4 = require('gl-matrix').mat4;

var nanoECS = require('nano-ecs');

var Mtrl = require('./mtrl.js');
var Mover = require('./mover.js');
var BodyModel = require('./body-model.js');
var Solid = require('neverball-solid');
var Shader = require('./shader.js');
var EC = require('./entity-components.js');
var SceneNode = require('./scene-node.js');

function SolidModel () {
  if (!(this instanceof SolidModel)) {
    return new SolidModel();
  }

  this.sceneRoot = null;
  this.entities = null;
  this.models = null;
  this.materials = null;

  // Transparency defaults. Overridden by ball skins, primarily.

  this.transparentDepthTest = true;
  this.transparentDepthMask = false;
}

/*
 * Load entities from SOL.
 */
SolidModel.fromSol = function (sol) {
  var solidModel = SolidModel();

  var sceneRoot = solidModel.sceneRoot = SceneNode();
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
    ent.addComponent(EC.SceneGraph);

    ent.sceneGraph.node = SceneNode(sceneRoot);

    var model = BodyModel.fromSolBody(sol, solBody);
    ent.drawable.model = models.length;
    models.push(model);

    // FIXME awkward
    ent.sceneGraph.node.data = model;

    // TODO should movers be entities?
    var movers = Mover.fromSolBody(sol, solBody);
    ent.movers.translate = movers.translate;
    ent.movers.rotate = movers.rotate;

    movers.translate.getPosition(ent.spatial.position);
    movers.rotate.getOrientation(ent.spatial.orientation);
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
    ent.addComponent(EC.SceneGraph);

    ent.item.value = solItem.n;

    vec3.copy(ent.spatial.position, solItem.p);
    ent.spatial.scale = 0.15; // Neverball default.
  }

  // Balls

  for (i = 0; i < sol.uv.length; ++i) {
    var solBall = sol.uv[i];

    ent = ents.createEntity().addTag('ball');

    ent.addComponent(EC.Spatial);

    ent.spatial.scale = solBall.r;
    vec3.copy(ent.spatial.position, solBall.p);
  }

  // Billboards

  for (i = 0; i < sol.rv.length; ++i) {
    var solBill = sol.rv[i];

    ent = ents.createEntity().addTag('billboard');

    ent.addComponent(EC.Spatial);
    ent.addComponent(EC.Billboard);

    vec3.copy(ent.spatial.position, solBill.p);

    ent.billboard.fromSolBill(sol, solBill);
  }

  return solidModel;
};

/*
 * Update systems.
 */
const systemComponents = [EC.Spatial, EC.Movers, EC.SceneGraph];

SolidModel.prototype.step = function (dt) {
  var ents = this.entities.queryComponents(systemComponents);

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

    // Update positions.

    // TODO do this only on actual update
    moverTranslate.getPosition(ent.spatial.position);
    moverRotate.getOrientation(ent.spatial.orientation);

    // Update scene node.

    ent.sceneGraph.setMatrix(ent.spatial.position, ent.spatial.orientation, ent.spatial.scale);
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
    try {
      Mtrl.loadTexture(gl, materials[i]);
    } catch (e) {
      console.error(e);
    }
  }
};

/*
 * Render entity meshes of the given type. Pass a parentMatrix for hierarchical transform.
 */
var _modelViewMatrix = mat4.create();
var _normalMatrix = mat3.create();
SolidModel.prototype.drawMeshType = function (state, meshType) {
  var ents = this.entities.queryComponents([EC.Drawable, EC.SceneGraph]);
  var models = this.models;

  for (var i = 0; i < ents.length; ++i) {
    var ent = ents[i];
    var model = models[ent.drawable.model];

    // Move this to scene TODO
    mat4.multiply(_modelViewMatrix, state._scene.view.getMatrix(), ent.sceneGraph.node.getWorldMatrix());
    mat3.fromMat4(_normalMatrix, _modelViewMatrix);

    state.defaultShader.uniforms.ModelViewMatrix.value = _modelViewMatrix;
    state.defaultShader.uniforms.NormalMatrix.value = _normalMatrix;

    model.drawMeshType(state, meshType);
  }
};

/*
 * Render model meshes.
 */
SolidModel.prototype.drawBodies = function (state) {
  var gl = state.gl;

  const mask = this.transparentDepthMask;
  const test = this.transparentDepthTest;

  // TODO mirrors
  this.drawMeshType(state, BodyModel.REFLECTIVE);

  this.drawMeshType(state, BodyModel.OPAQUE);
  this.drawMeshType(state, BodyModel.OPAQUE_DECAL);

  if (!test) gl.disable(gl.DEPTH_TEST);
  if (!mask) gl.depthMask(false);

  this.drawMeshType(state, BodyModel.TRANSPARENT_DECAL);
  this.drawMeshType(state, BodyModel.TRANSPARENT);

  if (!mask) gl.depthMask(true);
  if (!test) gl.enable(gl.DEPTH_TEST);
};

/*
 * Alias for a generic model.draw() interface.
 */
SolidModel.prototype.draw = SolidModel.prototype.drawBodies;

module.exports = SolidModel;
