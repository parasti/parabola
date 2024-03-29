'use strict';

var SceneNode = require('./scene-node.js');
var Batch = require('./batch.js');
var MeshData = require('./mesh-data.js');
var Solid = require('./solid.js');

module.exports = BodyModel;

var _modelIndex = 0;

/**
 * BodyModel is vertex data + a bunch of draw calls (batches) + transform matrices (scene node).
 */
function BodyModel () {
  if (!(this instanceof BodyModel)) {
    return new BodyModel();
  }

  // Globally unique name for this model.
  this.id = 'default_' + (_modelIndex++).toString();

  // Also known as draw calls.
  this.batches = null;

  // Also known as a vertex array object.
  this.meshData = MeshData();

  // Model-view matrices are managed by the scene graph.
  // We can set a parent node on this scene-node.
  // We can also create instances of this scene-node and
  // set parents on those instead.
  this.sceneNode = SceneNode();
}

BodyModel.prototype.getInstances = function () {
  return this.sceneNode.instances;
};

BodyModel.prototype.attachInstance = function (parent) {
  var instance = this.sceneNode.createInstance();
  instance.setParent(parent);
  return instance;
}

BodyModel.prototype.getInstanceMatrices = function (viewMatrix = null) {
  return this.sceneNode.getInstanceMatrices(viewMatrix);
};

BodyModel.getIdFromSolBody = function (sol, bodyIndex) {
  return 'BodyModel:' + sol.id + '#' + bodyIndex.toString();
};

BodyModel.fromSolBody = function (sol, bodyIndex) {
  var solBody = sol.bodies[bodyIndex];
  var model = BodyModel();

  model.id = BodyModel.getIdFromSolBody(sol, bodyIndex);

  model.getBatchesFromSol(sol, solBody);

  return model;
};

BodyModel.getIdFromSolBill = function (sol, billIndex) {
  var solBill = sol.bills[billIndex];

  return 'BillModel:' + ((solBill.fl & Solid.BILL_EDGE) ? 'edge__' : '') + sol.mtrls[solBill.mi].f;
}

BodyModel.fromSolBill = function (sol, billIndex) {
  const stride = 8;

  var bill = sol.rv[billIndex];

  var model = BodyModel();

  model.sceneNode._id = sol.id + ' bill_' + billIndex;

  model.id = BodyModel.getIdFromSolBill(sol, billIndex);

  var meshData = model.meshData;
  var verts = meshData.verts = new Float32Array(4 * stride); // 4 vertices
  var elems = meshData.elems = new Uint16Array(2 * 3); // 2 triangles
  var batches = model.batches = [];

  function addBillVert (i, x, y, s, t) {
    // position
    verts[i * stride + 0] = x;
    verts[i * stride + 1] = y;
    verts[i * stride + 2] = 0.0;
    // normal
    verts[i * stride + 3] = 0.0;
    verts[i * stride + 4] = 0.0;
    verts[i * stride + 5] = 1.0;
    // texcoords
    verts[i * stride + 6] = s;
    verts[i * stride + 7] = t;
  }

  // TODO
  // BILL_EDGE
  if (bill.fl & 0x1) {
    addBillVert(0, -0.5, 0.0, 0.0, 0.0);
    addBillVert(1, +0.5, 0.0, 1.0, 0.0);
    addBillVert(2, -0.5, 1.0, 0.0, 1.0);
    addBillVert(3, +0.5, 1.0, 1.0, 1.0);
  } else {
    addBillVert(0, -0.5, -0.5, 0.0, 0.0);
    addBillVert(1, +0.5, -0.5, 1.0, 0.0);
    addBillVert(2, -0.5, +0.5, 0.0, 1.0);
    addBillVert(3, +0.5, +0.5, 1.0, 1.0);
  }

  // GL_TRIANGLES

  elems[0] = 0;
  elems[1] = 1;
  elems[2] = 2;

  elems[3] = 1;
  elems[4] = 3;
  elems[5] = 2;

  // TODO create/get batch for billboard

  var batch = Batch();

  batch.mtrl = sol._materials[bill.mi];
  batch.shader = sol._shaders[bill.mi];
  batch.meshData = meshData;
  batch.elemBase = 0;
  batch.elemCount = 6;

  // Sort background billboards by order of appearance, and nothing else.
  if (bill.fl & Solid.BILL_BACK) {
    batch.setSortLayer(Batch.LAYER_BACKGROUND);
    batch.setSortExceptLayer(billIndex);
  } else {
    batch.defaultSortBits();
  }

  batches.push(batch);

  return model;
};

// TODO This is just a proxy, get rid of it.
BodyModel.prototype.createObjects = function (state) {
  var meshData = this.meshData;
  meshData.createObjects(state);
};

BodyModel.prototype.uploadModelViewMatrices = function (state, viewMatrix = null) {
  var model = this;
  var meshData = this.meshData;
  var gl = state.gl;

  if (!meshData.instanceVBO) {
    return;
  }

  var matrices = model.getInstanceMatrices(viewMatrix);

  if (matrices.length) {
    gl.bindBuffer(gl.ARRAY_BUFFER, meshData.instanceVBO);
    gl.bufferData(gl.ARRAY_BUFFER, matrices, gl.DYNAMIC_DRAW);
  }
}

/**
 * Sort a geom (triangle) into the appropriate material bucket.
 */
function addGeomByMtrl (geoms, geom) {
  var mi = geom.mi;

  if (geoms[mi]) {
    geoms[mi].push(geom);
  } else {
    geoms[mi] = [geom];
  }
}

/**
 * Sort body geoms (triangles) into per-material buckets.
 */
function getBodyGeomsByMtrl (sol, body) {
  var geoms = Array(sol.mtrls.length);

  var li, gi;

  // OBJ geometry.
  for (gi = 0; gi < body.gc; ++gi) {
    addGeomByMtrl(geoms, sol.gv[sol.iv[body.g0 + gi]]);
  }

  // Lump geometry.
  for (li = 0; li < body.lc; ++li) {
    var lump = sol.lv[body.l0 + li];

    for (gi = 0; gi < lump.gc; ++gi) {
      addGeomByMtrl(geoms, sol.gv[sol.iv[lump.g0 + gi]]);
    }
  }

  return geoms;
}

/**
 * Collect interleaved vertex attributes from SOL data structures.
 */
function getVertAttribs (verts, pos, sol, offs) {
  var p = sol.vv[offs.vi];
  var n = sol.sv[offs.si].n;
  var t = sol.tv[offs.ti];

  verts[pos + 0] = p[0];
  verts[pos + 1] = p[1];
  verts[pos + 2] = p[2];

  verts[pos + 3] = n[0];
  verts[pos + 4] = n[1];
  verts[pos + 5] = n[2];

  verts[pos + 6] = t[0];
  verts[pos + 7] = t[1];
}

/**
 * Create batches for a SOL body, one batch per material.
 */
BodyModel.prototype.getBatchesFromSol = function (sol, body) {
  var model = this;

  const stride = (3 + 3 + 2); // p + n + t

  var geomsByMtrl = getBodyGeomsByMtrl(sol, body);
  var geomsTotal = geomsByMtrl.reduce((total, geoms) => (total + geoms.length), 0);

  // Vertex store.
  var verts = new Float32Array(geomsTotal * 3 * stride);
  // Added vertices.
  var vertsTotal = 0;

  // Element store.
  var elems = new Uint16Array(geomsTotal * 3);
  // Added elements.
  var elemsTotal = 0;

  var meshData = model.meshData;
  var batches = [];

  // Add a single SOL vertex to the vertex store.
  function addVert (sol, offs) {
    var pos = vertsTotal * stride;
    getVertAttribs(verts, pos, sol, offs);
    vertsTotal++;
  }

  // Create a batch (draw call) for each material, using forEach to iterate over a sparse array.
  geomsByMtrl.forEach(function (geoms, mi) {
    var mtrl = sol._materials[mi];
    var shader = sol._shaders[mi];

    var batch = Batch();

    batch.mtrl = mtrl;
    batch.shader = shader;
    batch.meshData = meshData;
    batch.elemBase = elemsTotal;
    batch.elemCount = 0;

    batch.defaultSortBits();

    var offsToVert = [];

    for (var i = 0; i < geoms.length; ++i) {
      var geom = geoms[i];

      if (offsToVert[geom.oi] === undefined) {
        offsToVert[geom.oi] = vertsTotal;
        addVert(sol, sol.ov[geom.oi]);
      }

      if (offsToVert[geom.oj] === undefined) {
        offsToVert[geom.oj] = vertsTotal;
        addVert(sol, sol.ov[geom.oj]);
      }

      if (offsToVert[geom.ok] === undefined) {
        offsToVert[geom.ok] = vertsTotal;
        addVert(sol, sol.ov[geom.ok]);
      }

      elems[batch.elemBase + i * 3 + 0] = offsToVert[geom.oi];
      elems[batch.elemBase + i * 3 + 1] = offsToVert[geom.oj];
      elems[batch.elemBase + i * 3 + 2] = offsToVert[geom.ok];

      elemsTotal += 3;
    }

    batch.elemCount = elemsTotal - batch.elemBase;

    batches.push(batch);

    // Insert additional draw calls for multi-pass rendering.

    for (var passIndex = 1, passCount = mtrl.flagsPerPass.length; passIndex < passCount; ++passIndex) {
      // Copy batch, but set a different pass index.

      var extraBatch = Batch();
      Object.assign(extraBatch, batch);
      extraBatch.passIndex = passIndex;

      batches.push(extraBatch);
    }
  });

  meshData.verts = verts.slice(0, vertsTotal * stride);
  meshData.elems = elems;

  model.meshData = meshData;
  model.batches = batches;
};
