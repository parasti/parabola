'use strict';

var vec3 = require('gl-matrix').vec3;

var Mover = require('./mover.js');
var Solid = require('./solid.js');
var EC = require('./entity-components.js');
var SceneNode = require('./scene-node.js');

module.exports = SolidModel;

var solidModelIndex = 0;

function SolidModel (id) {
  if (!(this instanceof SolidModel)) {
    return new SolidModel(id);
  }

  this.id = id || 'SolidModel:' + (solidModelIndex++);
  this.sceneRoot = null;
  this.models = null;
}

/*
 * Load entities from SOL.
 */
SolidModel.fromSol = function (sol, entities) {
  var solidModel = SolidModel('SolidModel:' + sol.id);

  var sceneRoot = solidModel.sceneRoot = SceneNode();
  var ents = entities;
  var models = solidModel.models = [];
  var model = null;

  var i, n, ent;

  // Bodies

  for (i = 0; i < sol.bv.length; ++i) {
    var solBody = sol.bv[i];

    ent = ents.createEntity().addTag('body');

    ent.addComponent(EC.Spatial);
    ent.addComponent(EC.Movers);
    ent.addComponent(EC.SceneGraph);

    model = sol._models[i];

    // Add body-model to solid-model body-model (yup) list.
    models.push(model);

    // Attach a body-model node to the entity node.
    // var instance = model.sceneNode.createInstance();
    // instance.setParent(ent.sceneGraph.node);

    model.sceneNode.setParent(ent.sceneGraph.node);

    // Attach entity node to the solid-model node.
    ent.sceneGraph.setParent(sceneRoot);

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

    ent.sceneGraph.setParent(sceneRoot);

    ent.item.value = solItem.n;

    vec3.copy(ent.spatial.position, solItem.p);
    ent.spatial.scale = 0.15; // Neverball default.

    // Update scene node.
    ent.sceneGraph.setMatrix(ent.spatial.position, ent.spatial.orientation, ent.spatial.scale);
  }

  // Teleporters.

  for (i = 0, n = sol.jv.length; i < n; ++i) {
    var solJump = sol.jv[i];

    ent = ents.createEntity().addTag('jump');

    ent.addComponent(EC.Spatial);
    ent.addComponent(EC.SceneGraph);

    ent.sceneGraph.setParent(sceneRoot);

    vec3.copy(ent.spatial.position, solJump.p);
    ent.spatial.scale = [solJump.r, 2.0, solJump.r];

    // Update scene node.
    ent.sceneGraph.setMatrix(ent.spatial.position, ent.spatial.orientation, ent.spatial.scale);
  }

  // Balls

  for (i = 0; i < sol.uv.length; ++i) {
    var solBall = sol.uv[i];

    ent = ents.createEntity().addTag('ball').addTag('ballSolid').addTag('ballInner');

    ent.addComponent(EC.Spatial);
    ent.addComponent(EC.SceneGraph);

    ent.sceneGraph.setParent(sceneRoot);

    ent.spatial.scale = solBall.r;
    vec3.copy(ent.spatial.position, solBall.p);

    // Update scene node.
    ent.sceneGraph.setMatrix(ent.spatial.position, ent.spatial.orientation, ent.spatial.scale);
  }

  // Billboards

  for (i = 0, n = sol.rv.length; i < n; ++i) {
    var solBill = sol.rv[i];

    ent = ents.createEntity().addTag('billboard');

    ent.addComponent(EC.Spatial);
    ent.addComponent(EC.SceneGraph);
    ent.addComponent(EC.Billboard);

    ent.billboard.fromSolBill(sol, solBill);

    // Get cached billboard model
    model = sol._billboardModels[i];

    // Add body-model to solid-model body-model (yup) list.
    models.push(model);

    // Parent model scene-node to the entity scene-node.
    model.sceneNode.setParent(ent.sceneGraph.node);

    vec3.copy(ent.spatial.position, solBill.p);
    ent.spatial.scale = [1.0, 1.0, 1.0];

    // ent.billboard.fromSolBill(sol, solBill);

    // Parent entity scene-node to the solid-model scene-node.
    ent.sceneGraph.node.setParent(sceneRoot);
  }

  return solidModel;
};

SolidModel.prototype.setMeshLayer = function (layer) {
  var bodyModels = this.models;

  for (var i = 0, n = bodyModels.length; i < n; ++i) {
    var bodyModel = bodyModels[i];
    var meshes = bodyModel.meshes;

    for (var j = 0, m = meshes.length; j < m; ++j) {
      var mesh = meshes[j];

      mesh.setLayer(layer);
    }
  }
}