'use strict';

module.exports = BodyModel;

var Mtrl = require('./mtrl.js');

function BodyModel () {
  if (!(this instanceof BodyModel)) {
    return new BodyModel();
  }

  this.meshes = null;

  this.sortedMeshes = new Array(5); // TODO

  this.verts = null;
  this.vertsVBO = null;

  this.elems = null;
  this.elemsVBO = null;

  this.instanceVBO = null;
}

BodyModel.OPAQUE = 0;
BodyModel.OPAQUE_DECAL = 1;
BodyModel.TRANSPARENT_DECAL = 2;
BodyModel.TRANSPARENT = 3;
BodyModel.REFLECTIVE = 4;

BodyModel.fromSolBody = function (sol, solBody) {
  var model = BodyModel();

  model.getMeshesFromSol(sol, solBody);
  model.sortMeshes();

  return model;
};

BodyModel.prototype.createObjects = function (gl) {
  var vbo;

  vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, this.verts, gl.STATIC_DRAW);
  this.vertsVBO = vbo;

  vbo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.elems, gl.STATIC_DRAW);
  this.elemsVBO = vbo;

  // TODO cleanup
  this.instanceVBO = gl.createBuffer();
};

BodyModel.prototype.sortMeshes = function () {
  var opaque = this.sortedMeshes[BodyModel.OPAQUE] = [];
  var opaqueDecal = this.sortedMeshes[BodyModel.OPAQUE_DECAL] = [];
  var transparentDecal = this.sortedMeshes[BodyModel.TRANSPARENT_DECAL] = [];
  var transparent = this.sortedMeshes[BodyModel.TRANSPARENT] = [];
  var reflective = this.sortedMeshes[BodyModel.REFLECTIVE] = [];

  for (var i = 0; i < this.meshes.length; ++i) {
    var mesh = this.meshes[i];
    var mtrl = mesh.mtrl;

    if (Mtrl.isOpaque(mtrl)) {
      opaque.push(mesh);
    } else if (Mtrl.isOpaqueDecal(mtrl)) {
      opaqueDecal.push(mesh);
    } else if (Mtrl.isTransparentDecal(mtrl)) {
      transparentDecal.push(mesh);
    } else if (Mtrl.isTransparent(mtrl)) {
      transparent.push(mesh);
    } else if (Mtrl.isReflective(mtrl)) {
      reflective.push(mesh);
    }
  }
};

BodyModel.prototype.drawInstanced = function (state, count) {
  var model = this;
  var gl = state.gl;

  state.bindBuffer(gl.ARRAY_BUFFER, model.vertsVBO);

  gl.vertexAttribPointer(state.aPositionID, 3, gl.FLOAT, false, 8 * 4, 0);
  gl.vertexAttribPointer(state.aNormalID, 3, gl.FLOAT, false, 8 * 4, 12);
  gl.vertexAttribPointer(state.aTexCoordID, 2, gl.FLOAT, false, 8 * 4, 24);

  state.bindBuffer(gl.ARRAY_BUFFER, model.instanceVBO);

  gl.vertexAttribPointer(state.aModelViewMatrixID + 0, 4, gl.FLOAT, false, 16 * 4, 0);
  gl.vertexAttribPointer(state.aModelViewMatrixID + 1, 4, gl.FLOAT, false, 16 * 4, 16);
  gl.vertexAttribPointer(state.aModelViewMatrixID + 2, 4, gl.FLOAT, false, 16 * 4, 32);
  gl.vertexAttribPointer(state.aModelViewMatrixID + 3, 4, gl.FLOAT, false, 16 * 4, 48);

  state.vertexAttribDivisor(state.aModelViewMatrixID + 0, 1);
  state.vertexAttribDivisor(state.aModelViewMatrixID + 1, 1);
  state.vertexAttribDivisor(state.aModelViewMatrixID + 2, 1);
  state.vertexAttribDivisor(state.aModelViewMatrixID + 3, 1);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.elemsVBO);

  for (var i = 0; i < model.meshes.length; ++i) {
    drawMeshInstanced(state, model.meshes[i], count);
  }
};

function drawMeshInstanced (state, mesh, count) {
  var gl = state.gl;

  // Apply material state.
  Mtrl.draw(state, mesh.mtrl);

  // Update shader globals.
  state.defaultShader.uploadUniforms(gl);

  state.enableVertexAttribArray(state.aPositionID);
  state.enableVertexAttribArray(state.aNormalID);
  state.enableVertexAttribArray(state.aTexCoordID);

  state.enableVertexAttribArray(state.aModelViewMatrixID + 0);
  state.enableVertexAttribArray(state.aModelViewMatrixID + 1);
  state.enableVertexAttribArray(state.aModelViewMatrixID + 2);
  state.enableVertexAttribArray(state.aModelViewMatrixID + 3);

  // Took forever to figure out that glDrawElements offset is in bytes.
  state.drawElementsInstanced(gl.TRIANGLES, mesh.elemCount, gl.UNSIGNED_SHORT, mesh.elemBase * 2, count);
}

/*
 * Body mesh creation.
 */

function indexGeomByMtrl (geoms, geom) {
  var mi = geom.mi;

  if (!geoms[mi]) {
    geoms[mi] = [];
  }

  geoms[mi].push(geom);
}

function getBodyGeomsByMtrl (sol, body) {
  var geoms = [];

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

  getBodyGeomsByMtrl(sol, body).forEach(function (geoms, mi) {
    var mesh = {
      mtrl: sol.mv[mi],
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
