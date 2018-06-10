'use strict';

module.exports = BodyModel;

var Mtrl = require('./mtrl.js');

function BodyModel () {
  if (!(this instanceof BodyModel)) {
    return new BodyModel();
  }

  this.allMeshes = null;
  this.sortedMeshes = new Array(5);

  this.instanceVBO = null;
}

BodyModel.OPAQUE = 0;
BodyModel.OPAQUE_DECAL = 1;
BodyModel.TRANSPARENT_DECAL = 2;
BodyModel.TRANSPARENT = 3;
BodyModel.REFLECTIVE = 4;

BodyModel.fromSolBody = function (sol, solBody) {
  var model = BodyModel();
  model.allMeshes = getBodyMeshes(sol, solBody);
  model.sortMeshes();
  return model;
};

BodyModel.prototype.createObjects = function (gl) {
  var meshes = this.allMeshes;

  for (var i = 0; i < meshes.length; ++i) {
    var mesh = meshes[i];
    createMeshObjects(gl, mesh);
  }

  this.instanceVBO = gl.createBuffer();
};

BodyModel.prototype.sortMeshes = function () {
  var opaque = this.sortedMeshes[BodyModel.OPAQUE] = [];
  var opaqueDecal = this.sortedMeshes[BodyModel.OPAQUE_DECAL] = [];
  var transparentDecal = this.sortedMeshes[BodyModel.TRANSPARENT_DECAL] = [];
  var transparent = this.sortedMeshes[BodyModel.TRANSPARENT] = [];
  var reflective = this.sortedMeshes[BodyModel.REFLECTIVE] = [];

  for (var i = 0; i < this.allMeshes.length; ++i) {
    var mesh = this.allMeshes[i];
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

BodyModel.prototype.drawMeshType = function (state, meshType) {
  var meshes = this.sortedMeshes[meshType];
  for (var i = 0; i < meshes.length; ++i) {
    drawMesh(state, meshes[i]);
  }
};

BodyModel.prototype.drawInstanced = function (state, count) {
  var model = this;
  var gl = state.gl;

  if (model.instanceVBO) {
    state.bindBuffer(gl.ARRAY_BUFFER, model.instanceVBO);

    gl.vertexAttribPointer(state.aModelViewMatrixID + 0, 4, gl.FLOAT, false, 16 * 4, 0);
    gl.vertexAttribPointer(state.aModelViewMatrixID + 1, 4, gl.FLOAT, false, 16 * 4, 16);
    gl.vertexAttribPointer(state.aModelViewMatrixID + 2, 4, gl.FLOAT, false, 16 * 4, 32);
    gl.vertexAttribPointer(state.aModelViewMatrixID + 3, 4, gl.FLOAT, false, 16 * 4, 48);

    state.vertexAttribDivisor(state.aModelViewMatrixID + 0, 1);
    state.vertexAttribDivisor(state.aModelViewMatrixID + 1, 1);
    state.vertexAttribDivisor(state.aModelViewMatrixID + 2, 1);
    state.vertexAttribDivisor(state.aModelViewMatrixID + 3, 1);

    for (var i = 0; i < model.allMeshes.length; ++i) {
      drawMeshInstanced(state, model.allMeshes[i], count);
    }
  }
};

/*
 * Mesh rendering.
 */
function createMeshObjects (gl, mesh) {
  var vbo = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.verts, gl.STATIC_DRAW);

  mesh.vbo = vbo;

  var ebo = gl.createBuffer();

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.elems, gl.STATIC_DRAW);

  mesh.ebo = ebo;
}

function drawMeshInstanced (state, mesh, count) {
  var gl = state.gl;

  // Apply material state.
  Mtrl.draw(state, mesh.mtrl);

  // Update shader globals.
  state.defaultShader.uploadUniforms(gl);

  if (mesh.vbo) {
    state.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);

    gl.vertexAttribPointer(state.aPositionID, 3, gl.FLOAT, false, 8 * 4, 0);
    gl.vertexAttribPointer(state.aNormalID, 3, gl.FLOAT, false, 8 * 4, 12);
    gl.vertexAttribPointer(state.aTexCoordID, 2, gl.FLOAT, false, 8 * 4, 24);
  }

  state.enableVertexAttribArray(state.aPositionID);
  state.enableVertexAttribArray(state.aNormalID);
  state.enableVertexAttribArray(state.aTexCoordID);

  state.enableVertexAttribArray(state.aModelViewMatrixID + 0);
  state.enableVertexAttribArray(state.aModelViewMatrixID + 1);
  state.enableVertexAttribArray(state.aModelViewMatrixID + 2);
  state.enableVertexAttribArray(state.aModelViewMatrixID + 3);

  if (mesh.ebo) {
    state.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ebo);
    state.drawElementsInstanced(gl.TRIANGLES, mesh.elems.length, gl.UNSIGNED_SHORT, 0, count);
  }
}

function drawMesh (state, mesh) {
  var gl = state.gl;

  // Apply material state.
  Mtrl.draw(state, mesh.mtrl);

  // Update shader globals.
  state.defaultShader.uploadUniforms(gl);

  if (mesh.vbo) {
    state.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    gl.vertexAttribPointer(state.aPositionID, 3, gl.FLOAT, false, 8 * 4, 0);
    gl.vertexAttribPointer(state.aNormalID, 3, gl.FLOAT, false, 8 * 4, 12);
    gl.vertexAttribPointer(state.aTexCoordID, 2, gl.FLOAT, false, 8 * 4, 24);
    state.bindBuffer(gl.ARRAY_BUFFER, null);

    state.enableVertexAttribArray(state.aPositionID);
    state.enableVertexAttribArray(state.aNormalID);
    state.enableVertexAttribArray(state.aTexCoordID);

    state.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ebo);
    gl.drawElements(gl.TRIANGLES, mesh.elems.length, gl.UNSIGNED_SHORT, 0);
  }
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
  var vp = sol.vv[offs.vi];
  var sp = sol.sv[offs.si].n;
  var tp = sol.tv[offs.ti];

  vert[0] = vp[0];
  vert[1] = vp[1];
  vert[2] = vp[2];

  vert[3] = sp[0];
  vert[4] = sp[1];
  vert[5] = sp[2];

  vert[6] = tp[0];
  vert[7] = tp[1];
}

function addVertToMesh (mesh, sol, offs) {
  var pos = mesh.count * 8;
  var vert = mesh.verts.subarray(pos, pos + 8);

  getVertAttribs(sol, vert, offs);

  mesh.count++;
}

/*
 * Create a list of meshes from a SOL body, mesh per each used material.
 */
function getBodyMeshes (sol, body) {
  var meshes = [];

  getBodyGeomsByMtrl(sol, body).forEach(function (geoms, mi) {
    var mesh = {
      mtrl: sol.mv[mi],
      // 1 geom = 3 verts = 3 * (3 + 3 + 2) floats
      verts: new Float32Array(geoms.length * 3 * 8),
      elems: new Uint16Array(geoms.length * 3),
      count: 0
    };

    var elemCache = [];

    for (var i = 0; i < geoms.length; ++i) {
      var geom = geoms[i];

      if (elemCache[geom.oi] === undefined) {
        elemCache[geom.oi] = mesh.count;
        addVertToMesh(mesh, sol, sol.ov[geom.oi]);
      }

      if (elemCache[geom.oj] === undefined) {
        elemCache[geom.oj] = mesh.count;
        addVertToMesh(mesh, sol, sol.ov[geom.oj]);
      }

      if (elemCache[geom.ok] === undefined) {
        elemCache[geom.ok] = mesh.count;
        addVertToMesh(mesh, sol, sol.ov[geom.ok]);
      }

      mesh.elems[i * 3 + 0] = elemCache[geom.oi];
      mesh.elems[i * 3 + 1] = elemCache[geom.oj];
      mesh.elems[i * 3 + 2] = elemCache[geom.ok];
    }

    meshes.push(mesh);
  });

  return meshes;
}
