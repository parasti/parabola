'use strict';

module.exports = BodyModel;

var Mtrl = require('./mtrl.js');
var Shader = require('./shader.js');

var _modelIndex = 0;

function BodyModel () {
  if (!(this instanceof BodyModel)) {
    return new BodyModel();
  }

  this.meshes = null;

  this.verts = null;
  this.vertsVBO = null;

  this.elems = null;
  this.elemsVBO = null;

  this.instanceVBO = null;

  this.vao = null;

  this.id = 'default_' + (_modelIndex++).toString();
}

BodyModel.getIdFromSolBody = function (sol, bodyIndex) {
  return sol.crc.toString(16) + '_' + bodyIndex.toString();
}

BodyModel.fromSolBody = function (sol, bodyIndex) {
  var solBody = sol.bodies[bodyIndex];
  var model = BodyModel();

  model.id = BodyModel.getIdFromSolBody(sol, bodyIndex);

  model.getMeshesFromSol(sol, solBody);

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

  // Create and set up the VAO.

  model.vao = state.createVertexArray();

  state.bindVertexArray(model.vao);

  gl.bindBuffer(gl.ARRAY_BUFFER, model.vertsVBO);

  gl.vertexAttribPointer(state.aPositionID, 3, gl.FLOAT, false, 8 * 4, 0);
  gl.vertexAttribPointer(state.aNormalID, 3, gl.FLOAT, false, 8 * 4, 12);
  gl.vertexAttribPointer(state.aTexCoordID, 2, gl.FLOAT, false, 8 * 4, 24);

  gl.bindBuffer(gl.ARRAY_BUFFER, model.instanceVBO);

  gl.vertexAttribPointer(state.aModelViewMatrixID + 0, 4, gl.FLOAT, false, 16 * 4, 0);
  gl.vertexAttribPointer(state.aModelViewMatrixID + 1, 4, gl.FLOAT, false, 16 * 4, 16);
  gl.vertexAttribPointer(state.aModelViewMatrixID + 2, 4, gl.FLOAT, false, 16 * 4, 32);
  gl.vertexAttribPointer(state.aModelViewMatrixID + 3, 4, gl.FLOAT, false, 16 * 4, 48);

  state.vertexAttribDivisor(state.aModelViewMatrixID + 0, 1);
  state.vertexAttribDivisor(state.aModelViewMatrixID + 1, 1);
  state.vertexAttribDivisor(state.aModelViewMatrixID + 2, 1);
  state.vertexAttribDivisor(state.aModelViewMatrixID + 3, 1);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.elemsVBO);

  gl.enableVertexAttribArray(state.aPositionID);
  gl.enableVertexAttribArray(state.aNormalID);
  gl.enableVertexAttribArray(state.aTexCoordID);

  gl.enableVertexAttribArray(state.aModelViewMatrixID + 0);
  gl.enableVertexAttribArray(state.aModelViewMatrixID + 1);
  gl.enableVertexAttribArray(state.aModelViewMatrixID + 2);
  gl.enableVertexAttribArray(state.aModelViewMatrixID + 3);

  state.bindVertexArray(null);
};

BodyModel.prototype.drawInstanced = function (state, count) {
  var model = this;
  var gl = state.gl;

  if (model.vao) {
    state.bindVertexArray(model.vao);

    for (var i = 0; i < model.meshes.length; ++i) {
      drawMeshInstanced(state, model.meshes[i], count);
    }

    state.bindVertexArray(null);
  }
};

function drawMeshInstanced (state, mesh, count) {
  var gl = state.gl;

  var mtrl = mesh.mtrl;
  var shader = mesh.shader;

  // Apply material state.
  mtrl.draw(state);

  // Bind shader.
  shader.use(state);

  // Update shader globals.
  shader.uploadUniforms(state);

  // PSA: glDrawElements offset is in bytes.
  state.drawElementsInstanced(gl.TRIANGLES, mesh.elemCount, gl.UNSIGNED_SHORT, mesh.elemBase * 2, count);
}

/*
 * Body mesh creation.
 */

function indexGeomByMtrl (geoms, geom) {
  var mi = geom.mi;

  if (geoms[mi] === undefined) {
    geoms[mi] = [];
  }

  geoms[mi].push(geom);
}

function getBodyGeomsByMtrl (sol, body) {
  var geoms = Array(sol.mtrls.length);

  var li, gi;

  // OBJ geometry.
  for (gi = 0; gi < body.gc; ++gi) {
    indexGeomByMtrl(geoms, sol.gv[sol.iv[body.g0 + gi]]);
  }

  // Lump geometry.
  for (li = 0; li < body.lc; ++li) {
    var lump = sol.lv[body.l0 + li];
    for (gi = 0; gi < lump.gc; ++gi) {
      indexGeomByMtrl(geoms, sol.gv[sol.iv[lump.g0 + gi]]);
    }
  }

  return geoms;
}

function getVertAttribs (sol, vert, offs) {
  var p = sol.vv[offs.vi];
  var n = sol.sv[offs.si].n;
  var t = sol.tv[offs.ti];

  vert[0] = p[0];
  vert[1] = p[1];
  vert[2] = p[2];

  vert[3] = n[0];
  vert[4] = n[1];
  vert[5] = n[2];

  vert[6] = t[0];
  vert[7] = t[1];
}

/*
 * Create a list of meshes from a SOL body, mesh per each used material.
 */
BodyModel.prototype.getMeshesFromSol = function (sol, body) {
  const stride = (3 + 3 + 2); // p + n + t

  var geomsByMtrl = getBodyGeomsByMtrl(sol, body);
  var geomsTotal = geomsByMtrl.reduce((total, geoms) => (total + geoms.length), 0);

  var verts = new Float32Array(geomsTotal * 3 * stride);
  var vertsTotal = 0;

  var elems = new Uint16Array(geomsTotal * 3);
  var elemsTotal = 0;

  var meshes = [];

  function addVert (sol, offs) {
    var pos = vertsTotal * stride;
    var vert = verts.subarray(pos, pos + stride);
    getVertAttribs(sol, vert, offs);
    vertsTotal++;
  }

  geomsByMtrl.forEach(function (geoms, mi) {
    var mtrl = sol._materials[mi];
    var shader = sol._shaders[mi];

    var mesh = {
      mtrl: mtrl,
      shader: shader,
      elemBase: elemsTotal,
      elemCount: 0
    };

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
