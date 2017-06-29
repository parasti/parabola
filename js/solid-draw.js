'use strict';

var Mesh = require('./mesh.js');
var Mover = require('./mover.js');
var Solid = require('./solid.js');

Solid.prototype.initRenderState = function(gl) {
  this.loadMeshes();
  this.createVBOsAndTextures(gl);
}

/*
 * Collect body geoms into an array indexed by SOL material ID.
 */
function addGeomByMtrl(geoms, geom) {
  var mi = geom.mi;
  geoms[mi] = geoms[mi] || [];
  geoms[mi].push(geom);
}

Solid.prototype.getBodyGeomsByMtrl = function (body) {
  var geoms = [];

  for (var gi = 0; gi < body.gc; ++gi) {
    addGeomByMtrl(geoms, this.gv[this.iv[body.g0 + gi]]);
  }

  for (var li = 0; li < body.lc; ++li) {
    var lump = this.lv[body.l0 + li];
    for (var gi = 0; gi < lump.gc; ++gi) {
      addGeomByMtrl(geoms, this.gv[this.iv[lump.g0 + gi]]);
    }
  }

  return geoms;
};

/*
 * Collect vertex attributes described by a SOL offs into a Float32Array.
 */
Solid.prototype.getVert = function (vert, offs) {
  var vp = this.vv[offs.vi];
  var sp = this.sv[offs.si].n;
  var tp = this.tv[offs.ti];

  vert[0] = vp[0];
  vert[1] = vp[1];
  vert[2] = vp[2];

  vert[3] = sp[0];
  vert[4] = sp[1];
  vert[5] = sp[2];

  vert[6] = tp[0];
  vert[7] = tp[1];
};

/*
 * Create a list of meshes from a SOL body, mesh per each used material.
 */
Solid.prototype.getBodyMeshes = function (body) {
  var meshes = [];
  var self = this;

  this.getBodyGeomsByMtrl(body).forEach(function (geoms, mi) {
    var mtrl = self.mv[mi];
    var mesh = new Mesh(geoms.length * 3, mtrl);

    geoms.forEach(function (geom) {
      mesh.addVertFromSol(self, self.ov[geom.oi]);
      mesh.addVertFromSol(self, self.ov[geom.oj]);
      mesh.addVertFromSol(self, self.ov[geom.ok]);
    });

    meshes.push(mesh);
  });

  return meshes;
};

/*
 * Load meshes for each body.
 */
Solid.prototype.loadMeshes = function() {
  for (var i = 0; i < this.bv.length; ++i) {
    this.bv[i].loadMeshes(this);
  }
}

/*
 * Create body mesh VBOs and textures.
 */
Solid.prototype.createVBOsAndTextures = function(gl) {
  for (var i = 0; i < this.bv.length; ++i) {
    var meshes = this.bv[i].meshes;

    for (var j = 0; j < meshes.length; ++j) {
      var mesh = meshes[j];
      mesh.createVBO(gl);
      // TODO Keep a shared material cache instead of per-SOL?
      mesh.mtrl.loadTexture(gl);
    }
  }
}

/*
 * Render body meshes.
 */
Solid.prototype.drawMeshType = function(gl, state, meshType) {
  var bodies = this.bv;

  for (var i = 0; i < bodies.length; ++i) {
    var body = bodies[i];
    gl.uniformMatrix4fv(state.uModelID, false, body.getTransform());
    body.drawMeshType(gl, state, meshType);
  }
}

Solid.prototype.drawBodies = function(gl, state) {
  // TODO
  gl.enableVertexAttribArray(state.aPositionID);
  gl.enableVertexAttribArray(state.aNormalID);
  gl.enableVertexAttribArray(state.aTexCoordID);

  // TODO
  this.drawMeshType(gl, state, 'reflective');

  this.drawMeshType(gl, state, 'opaque');
  this.drawMeshType(gl, state, 'opaqueDecal');

  // TODO?
  gl.depthMask(false);
  {
    this.drawMeshType(gl, state, 'transparentDecal');
    this.drawMeshType(gl, state, 'transparent');
  }
  gl.depthMask(true);

  gl.disableVertexAttribArray(this.aPositionID);
  gl.disableVertexAttribArray(this.aNormalID);
  gl.disableVertexAttribArray(this.aTexCoordID);
}

module.exports = Solid;