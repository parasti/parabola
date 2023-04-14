'use strict';

var vec3 = require('gl-matrix').vec3;

var Mover = require('./mover.js');
var Solid = require('./solid.js');
var EC = require('./entity-components.js');
var SceneNode = require('./scene-node.js');

module.exports = SolidModel;

var solidModelIndex = 0;

function SolidModel(id) {
  if (!(this instanceof SolidModel)) {
    return new SolidModel(id);
  }

  this.id = id || 'SolidModel:' + (solidModelIndex++);
  this.sceneNode = SceneNode();
  this.models = null;
}

/*
 * Load entities from SOL.
 */
SolidModel.fromSol = function (sol, entities) {
  var solidModel = SolidModel('SolidModel:' + sol.id);
  solidModel.sceneNode._id = sol.id;

  var modelNode = solidModel.sceneNode;
  var ents = entities;
  var models = solidModel.models = [];
  var model = null;

  var i, n, ent;

  // Bodies

  for (i = 0; i < sol.bv.length; ++i) {
    var solBody = sol.bv[i];

    ent = ents.createEntity();

    ent.addComponent(EC.Spatial);
    ent.addComponent(EC.Movers);
    ent.addComponent(EC.SceneGraph);

    // Body entities do not get a SceneModel component.

    model = sol._models[i];

    // Add body-model to solid-model body-model (yup) list.
    models.push(model);

    model.sceneNode.setParent(ent.sceneGraph.node);

    // Attach entity node to the solid-model node.
    ent.sceneGraph.setParent(modelNode);

    ent.sceneGraph.node._id = sol.id + ' body_' + i + ' entity';

    ent.movers.fromSolBody(sol, solBody);
    ent.movers.translate.getPosition(ent.spatial.position);
    ent.movers.rotate.getOrientation(ent.spatial.orientation);
  }

  // Items

  for (i = 0; i < sol.hv.length; ++i) {
    var solItem = sol.hv[i];
    var itemType = '';

    if (solItem.t === Solid.ITEM_GROW) {
      itemType = 'grow';
    } else if (solItem.t === Solid.ITEM_SHRINK) {
      itemType = 'shrink';
    } else if (solItem.t === Solid.ITEM_COIN) {
      if (solItem.n >= 10) {
        itemType = 'coin10';
      } else if (solItem.n >= 5) {
        itemType = 'coin5';
      } else {
        itemType = 'coin';
      }
    } else {
      continue;
    }

    ent = ents.createEntity();

    ent.addComponent(EC.Item);
    ent.addComponent(EC.Spatial);
    ent.addComponent(EC.SceneGraph);
    ent.addComponent(EC.SceneModel);

    ent.sceneModel.setSlot(itemType);

    ent.item.value = solItem.n;

    vec3.copy(ent.spatial.position, solItem.p);
    ent.spatial.scale = 0.15; // Neverball default.
  }

  // Teleporters.

  for (i = 0, n = sol.jv.length; i < n; ++i) {
    var solJump = sol.jv[i];

    ent = ents.createEntity();

    ent.addComponent(EC.Spatial);
    ent.addComponent(EC.SceneGraph);
    ent.addComponent(EC.SceneModel);

    // TODO
    ent.sceneModel.setSlot('jump');

    vec3.copy(ent.spatial.position, solJump.p);
    ent.spatial.scale = [solJump.r, 2.0, solJump.r];
  }

  // Balls

  for (i = 0; i < sol.uv.length; ++i) {
    var solBall = sol.uv[i];

    ent = ents.createEntity();

    ent.addComponent(EC.Spatial);
    ent.addComponent(EC.SceneGraph);
    ent.addComponent(EC.SceneModel);

    ent.sceneModel.setSlot('ballSolid');

    ent.spatial.scale = solBall.r;
    vec3.copy(ent.spatial.position, solBall.p);

    {
      var inner = ents.createEntity();

      inner.addComponent(EC.Spatial);
      inner.addComponent(EC.SceneGraph);
      inner.addComponent(EC.SceneModel);

      inner.sceneModel.setSlot('ballInner');

      inner.sceneGraph.setParent(ent.sceneGraph.node);

      inner.spatial.scale = solBall.r;
      vec3.copy(inner.spatial.position, solBall.p);

      var outer = ents.createEntity();

      outer.addComponent(EC.Spatial);
      outer.addComponent(EC.SceneGraph);
      outer.addComponent(EC.SceneModel);

      outer.sceneModel.setSlot('ballOuter');

      outer.sceneGraph.setParent(ent.sceneGraph.node);

      outer.spatial.scale = solBall.r;
      vec3.copy(outer.spatial.position, solBall.p);
    }
  }

  // Billboards

  for (i = 0, n = sol.rv.length; i < n; ++i) {
    var solBill = sol.rv[i];

    ent = ents.createEntity();

    ent.addComponent(EC.Spatial);
    ent.addComponent(EC.SceneGraph);
    ent.addComponent(EC.Billboard);

    ent.billboard.fromSolBill(sol, solBill);

    // Get cached billboard model
    model = sol._billboardModels[i];

    // Add body-model to solid-model body-model (yup) list.
    if (models.indexOf(model) < 0) {
      models.push(model);
    }

    // Parent model scene-node to the entity scene-node.
    model.attachInstance(ent.sceneGraph.node);

    ent.sceneGraph.setParent(modelNode);

    vec3.copy(ent.spatial.position, solBill.p);
    ent.spatial.scale = [1.0, 1.0, 1.0];
  }

  return solidModel;
};

SolidModel.prototype.setBatchSortLayer = function (layer) {
  var bodyModels = this.models;

  for (var i = 0, n = bodyModels.length; i < n; ++i) {
    var bodyModel = bodyModels[i];
    var batches = bodyModel.batches;

    for (var j = 0, m = batches.length; j < m; ++j) {
      var batch = batches[j];

      batch.setSortLayer(layer);
    }
  }
}

/**
 * Create an instance of the model's scene node and attach it to the given parent node.
 *
 * @param {SceneNode} parent parent scene node
 * @returns {SceneNode} model scene node
 */
SolidModel.prototype.attachInstance = function (parent) {
  var instance = this.sceneNode.createInstance();
  instance.setParent(parent);
  return instance;
}