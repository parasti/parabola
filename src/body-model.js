'use strict';

var SceneNode = require('./scene-node.js');
var Mesh = require('./mesh.js');
var Solid = require('./solid.js');

module.exports = BodyModel;

var _modelIndex = 0;

/**
 * BodyModel is vertex data + a bunch of draw calls (meshes) + transform matrices (scene node).
 */
function BodyModel () {
  if (!(this instanceof BodyModel)) {
    return new BodyModel();
  }

  // Globally unique name for this model.
  this.id = 'default_' + (_modelIndex++).toString();

  // Also known as draw calls.
  this.meshes = null;

  // Vertex data and store.
  this.verts = null;
  this.vertsVBO = null;

  // Element data and store.
  this.elems = null;
  this.elemsVBO = null;

  // Model-view matrix store. 1 matrix per scene-node instance.
  this.instanceVBO = null;

  // All of the above, but activated with one GL call.
  this.vao = null;

  // Model-view matrices are managed by the scene graph.
  // We can set a parent node on this scene-node.
  // We can also create instances of this scene-node and
  // set parents on those instead.
  this.sceneNode = SceneNode();
}

BodyModel.prototype.getInstances = function () {
  return this.sceneNode.instances;
};

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

  model.getMeshesFromSol(sol, solBody);

  return model;
};

BodyModel.fromSolBill = function (sol, billIndex) {
  const stride = 8;

  var bill = sol.rv[billIndex];

  var model = BodyModel();
  var verts = model.verts = new Float32Array(4 * stride); // 4 vertices
  var elems = model.elems = new Uint16Array(2 * 3); // 2 triangles
  var meshes = model.meshes = [];

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

  // TODO create/get mesh for billboard

  var mesh = Mesh();

  mesh.mtrl = sol._materials[bill.mi];
  mesh.shader = sol._shaders[bill.mi];
  mesh.model = model;
  mesh.elemBase = 0;
  mesh.elemCount = 6;

  // Sort background billboards by order of appearance, and nothing else.
  if (bill.fl & Solid.BILL_BACK) {
    mesh.setSortLayer(Mesh.LAYER_BACKGROUND);
    mesh.setSortExceptLayer(billIndex);
  } else {
    mesh.defaultSortBits();
  }

  meshes.push(mesh);

  return model;
};

BodyModel.prototype.createObjects = function (state) {
  var model = this;
  var gl = state.gl;

  // Create VBOs.

  model.vertsVBO = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, model.vertsVBO);
  gl.bufferData(gl.ARRAY_BUFFER, model.verts, gl.STATIC_DRAW);

  model.elemsVBO = gl.createBuffer();

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.elemsVBO);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.elems, gl.STATIC_DRAW);

  model.instanceVBO = gl.createBuffer();
  /*
   * Matrix data depends on the number of model instances,
   * which is not yet known at this point.
   */

  // Create and set up the VAO.

  model.vao = state.createVertexArray();

  state.bindVertexArray(model.vao);

  gl.bindBuffer(gl.ARRAY_BUFFER, model.vertsVBO);

  gl.vertexAttribPointer(state.aPositionID, 3, gl.FLOAT, false, 8 * 4, 0);
  gl.vertexAttribPointer(state.aNormalID, 3, gl.FLOAT, false, 8 * 4, 12);
  gl.vertexAttribPointer(state.aTexCoordID, 2, gl.FLOAT, false, 8 * 4, 24);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.elemsVBO);

  gl.enableVertexAttribArray(state.aPositionID);
  gl.enableVertexAttribArray(state.aNormalID);
  gl.enableVertexAttribArray(state.aTexCoordID);

  gl.enableVertexAttribArray(state.aModelViewMatrixID + 0);
  gl.enableVertexAttribArray(state.aModelViewMatrixID + 1);
  gl.enableVertexAttribArray(state.aModelViewMatrixID + 2);
  gl.enableVertexAttribArray(state.aModelViewMatrixID + 3);

  gl.bindBuffer(gl.ARRAY_BUFFER, model.instanceVBO);

  gl.vertexAttribPointer(state.aModelViewMatrixID + 0, 4, gl.FLOAT, false, 16 * 4, 0);
  gl.vertexAttribPointer(state.aModelViewMatrixID + 1, 4, gl.FLOAT, false, 16 * 4, 16);
  gl.vertexAttribPointer(state.aModelViewMatrixID + 2, 4, gl.FLOAT, false, 16 * 4, 32);
  gl.vertexAttribPointer(state.aModelViewMatrixID + 3, 4, gl.FLOAT, false, 16 * 4, 48);

  state.vertexAttribDivisor(state.aModelViewMatrixID + 0, 1);
  state.vertexAttribDivisor(state.aModelViewMatrixID + 1, 1);
  state.vertexAttribDivisor(state.aModelViewMatrixID + 2, 1);
  state.vertexAttribDivisor(state.aModelViewMatrixID + 3, 1);

  state.bindVertexArray(null);
};

BodyModel.prototype.bindArray = function (state) {
  var model = this;

  if (model.vao) {
    state.bindVertexArray(model.vao);
  }
};

/**
 * Add a geom (triangle) to the list, indexed by used material.
 */
function addGeomByMtrl (geoms, geom) {
  var mi = geom.mi;

  if (geoms[mi] === undefined) {
    geoms[mi] = [];
  }

  geoms[mi].push(geom);
}

/**
 * Get a list of geoms (triangles) for a body, indexed by material.
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
 * Create meshes for a SOL body, one mesh per material.
 */
BodyModel.prototype.getMeshesFromSol = function (sol, body) {
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

  var meshes = [];

  // Add a single SOL vertex to the vertex store.
  function addVert (sol, offs) {
    var pos = vertsTotal * stride;
    // var vert = verts.subarray(pos, pos + stride);
    // getVertAttribs(vert, sol, offs);
    getVertAttribs(verts, pos, sol, offs);
    vertsTotal++;
  }

  // Create a mesh (draw call) for each material, using forEach to iterate over a sparse array.
  geomsByMtrl.forEach(function (geoms, mi) {
    var mtrl = sol._materials[mi];
    var shader = sol._shaders[mi];

    var mesh = Mesh();

    mesh.mtrl = mtrl;
    mesh.shader = shader;
    mesh.model = model;
    mesh.elemBase = elemsTotal;
    mesh.elemCount = 0;

    mesh.defaultSortBits();

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

      elems[mesh.elemBase + i * 3 + 0] = offsToVert[geom.oi];
      elems[mesh.elemBase + i * 3 + 1] = offsToVert[geom.oj];
      elems[mesh.elemBase + i * 3 + 2] = offsToVert[geom.ok];

      elemsTotal += 3;
    }

    mesh.elemCount = elemsTotal - mesh.elemBase;

    meshes.push(mesh);
  });

  this.meshes = meshes;
  this.verts = verts.slice(0, vertsTotal * stride);
  this.elems = elems;
};
