'use strict';

module.exports = BodyModel;

var Mtrl = require('./mtrl.js');

function BodyModel () {
  var model = Object.create(BodyModel.prototype);
  model.meshes = null; // Both array and dictionary
  return model;
}

BodyModel.fromSolBody = function (sol, solBody) {
  var model = BodyModel();
  model.meshes = getBodyMeshes(sol, solBody);
  model.sortMeshes();
  return model;
};

BodyModel.prototype.createObjects = function (gl) {
  var meshes = this.meshes;

  for (var i = 0; i < meshes.length; ++i) {
    var mesh = meshes[i];
    createMeshObjects(gl, mesh);
  }
};

BodyModel.prototype.sortMeshes = function () {
  var opaqueMeshes = this.meshes.opaque = [];
  var opaqueDecalMeshes = this.meshes.opaqueDecal = [];
  var transparentDecalMeshes = this.meshes.transparentDecal = [];
  var transparentMeshes = this.meshes.transparent = [];
  var reflectiveMeshes = this.meshes.reflective = [];

  for (var i = 0; i < this.meshes.length; ++i) {
    var mesh = this.meshes[i];
    var mtrl = mesh.mtrl;

    if (Mtrl.isOpaque(mtrl)) {
      opaqueMeshes.push(mesh);
    } else if (Mtrl.isOpaqueDecal(mtrl)) {
      opaqueDecalMeshes.push(mesh);
    } else if (Mtrl.isTransparentDecal(mtrl)) {
      transparentDecalMeshes.push(mesh);
    } else if (Mtrl.isTransparent(mtrl)) {
      transparentMeshes.push(mesh);
    } else if (Mtrl.isReflective(mtrl)) {
      reflectiveMeshes.push(mesh);
    }
  }
};

BodyModel.prototype.drawMeshType = function (gl, state, meshType) {
  var meshes = this.meshes[meshType];
  for (var i = 0; i < meshes.length; ++i) {
    drawMesh(gl, state, meshes[i]);
  }
};

/*
 * Mesh rendering.
 */
function createMeshObjects (gl, mesh) {
  var vbo = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.verts, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  mesh.vbo = vbo;

  var ebo = gl.createBuffer();

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.elems, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  mesh.ebo = ebo;
}

function drawMesh (gl, state, mesh) {
  Mtrl.draw(gl, state, mesh.mtrl);

  state.defaultShader.uploadUniforms(gl);

  if (mesh.vbo) {
    state.enableArray(gl, state.aPositionID);
    state.enableArray(gl, state.aNormalID);
    state.enableArray(gl, state.aTexCoordID);

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    gl.vertexAttribPointer(state.aPositionID, 3, gl.FLOAT, false, 8 * 4, 0);
    gl.vertexAttribPointer(state.aNormalID, 3, gl.FLOAT, false, 8 * 4, 12);
    gl.vertexAttribPointer(state.aTexCoordID, 2, gl.FLOAT, false, 8 * 4, 24);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ebo);
    gl.drawElements(gl.TRIANGLES, mesh.elems.length, gl.UNSIGNED_SHORT, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
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
