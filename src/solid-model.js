'use strict';

var vec3 = require('gl-matrix').vec3;

var nanoECS = require('nano-ecs');

var Mover = require('./mover.js');
var BodyModel = require('./body-model.js');
var Solid = require('neverball-solid');
var EC = require('./entity-components.js');
var SceneNode = require('./scene-node.js');

module.exports = SolidModel;

function SolidModel () {
  if (!(this instanceof SolidModel)) {
    return new SolidModel();
  }

  this.sceneRoot = null;
  this.entities = null;
  this.models = null;
}

/*
 * Load entities from SOL.
 */
SolidModel.fromSol = function (sol) {
  var solidModel = SolidModel();

  var sceneRoot = solidModel.sceneRoot = SceneNode();
  var ents = solidModel.entities = nanoECS();
  var models = solidModel.models = [];

  var i, ent;

  // Bodies

  for (i = 0; i < sol.bv.length; ++i) {
    var solBody = sol.bv[i];

    ent = ents.createEntity().addTag('body');

    ent.addComponent(EC.Spatial);
    ent.addComponent(EC.Movers);
    ent.addComponent(EC.SceneGraph);

    // FIXME awkward
    var model = BodyModel.fromSolBody(sol, solBody);
    models.push(model);

    ent.sceneGraph.setModel(model);
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
SolidModel.prototype.createObjects = function (state) {
  var models = this.models;
  var i;

  for (i = 0; i < models.length; ++i) {
    var model = models[i];
    if (model) {
      model.createObjects(state);
    }
  }
};
