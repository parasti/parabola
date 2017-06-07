'use strict';

var util = require('./util.js');

var Mtrl = require('./mtrl.js');
var Mesh = require('./mesh.js');
var View = require('./view.js');

/*
 * Neverball SOL file.
 */
var Solid = function () {
  this.ac = 0;
  this.dc = 0;
  this.mc = 0;
  this.vc = 0;
  this.ec = 0;
  this.sc = 0;
  this.tc = 0;
  this.oc = 0;
  this.gc = 0;
  this.lc = 0;
  this.nc = 0;
  this.pc = 0;
  this.bc = 0;
  this.hc = 0;
  this.zc = 0;
  this.jc = 0;
  this.xc = 0;
  this.rc = 0;
  this.uc = 0;
  this.wc = 0;
  this.ic = 0;

  this.av = null;
  this.dv = null;
  this.vv = null;
  this.ev = null;
  this.sv = null;
  this.tv = null;
  this.ov = null;
  this.gv = null;
  this.lv = null;
  this.nv = null;
  this.pv = null;
  this.bv = null;
  this.hv = null;
  this.zv = null;
  this.jv = null;
  this.xv = null;
  this.rv = null;
  this.uv = null;
  this.wv = null;
  this.iv = null;
};

Solid.MAGIC = 0x4c4f53af;
Solid.VERSION = 7;

/*
 * Load a SOL file from the given ArrayBuffer.
 */
Solid.load = function (buffer) {
  // TODO move to a worker
  var stream = new util.DataStream(buffer);
  var sol = new Solid();

  sol.magic = stream.getInt32();
  sol.version = stream.getInt32();

  if (sol.magic !== Solid.MAGIC || sol.version !== Solid.VERSION) {
    // TODO throw
    return;
  }

  sol.ac = stream.getInt32();
  sol.dc = stream.getInt32();
  sol.mc = stream.getInt32();
  sol.vc = stream.getInt32();
  sol.ec = stream.getInt32();
  sol.sc = stream.getInt32();
  sol.tc = stream.getInt32();
  sol.oc = stream.getInt32();
  sol.gc = stream.getInt32();
  sol.lc = stream.getInt32();
  sol.nc = stream.getInt32();
  sol.pc = stream.getInt32();
  sol.bc = stream.getInt32();
  sol.hc = stream.getInt32();
  sol.zc = stream.getInt32();
  sol.jc = stream.getInt32();
  sol.xc = stream.getInt32();
  sol.rc = stream.getInt32();
  sol.uc = stream.getInt32();
  sol.wc = stream.getInt32();
  sol.ic = stream.getInt32();

  sol.av = stream.getUint8Array(sol.ac);
  sol.loadDicts(stream);
  sol.loadMtrls(stream);
  sol.loadVerts(stream);
  sol.loadEdges(stream);
  sol.loadSides(stream);
  sol.loadTexcs(stream);
  sol.loadOffs(stream);
  sol.loadGeoms(stream);
  sol.loadLumps(stream);
  sol.loadNodes(stream);
  sol.loadPaths(stream);
  sol.loadBodies(stream);
  sol.loadItems(stream);
  sol.loadGoals(stream);
  sol.loadJumps(stream);
  sol.loadSwitches(stream);
  sol.loadBills(stream);
  sol.loadBalls(stream);
  sol.loadViews(stream);
  sol.iv = stream.getInt32Array(sol.ic);

  return sol;
};

Solid.prototype.loadDicts = function (stream) {
  var dicts = {};

  for (var i = 0; i < this.dc; ++i) {
    var ai = stream.getInt32();
    var aj = stream.getInt32();

    var key = util.getCString(this.av, ai);
    var val = util.getCString(this.av, aj);

    dicts[key] = val;
  }
  this.dv = dicts;
};

Solid.prototype.loadMtrls = function (stream) {
  var mtrls = [];

  for (var i = 0; i < this.mc; ++i)
    mtrls.push(Mtrl.load(stream));

  this.mv = mtrls;
};

Solid.prototype.loadVerts = function (stream) {
  var verts = [];

  for (var i = 0; i < this.vc; ++i) {
    verts.push(stream.getFloat32Array(3));
  }

  this.vv = verts;
};

Solid.prototype.loadEdges = function (stream) {
  var edges = [];

  for (var i = 0; i < this.ec; ++i) {
    edges.push({
      vi: stream.getInt32(),
      vj: stream.getInt32()
    });
  }

  this.ev = edges;
};

Solid.prototype.loadSides = function (stream) {
  var sides = [];

  for (var i = 0; i < this.sc; ++i) {
    sides.push({
      n: stream.getFloat32Array(3),
      d: stream.getFloat32()
    });
  }

  this.sv = sides;
};

Solid.prototype.loadTexcs = function (stream) {
  var texcs = [];

  for (var i = 0; i < this.tc; ++i) {
    texcs.push(stream.getFloat32Array(2));
  }

  this.tv = texcs;
};

Solid.prototype.loadOffs = function (stream) {
  var offs = [];

  for (var i = 0; i < this.oc; ++i) {
    offs.push({
      ti: stream.getInt32(),
      si: stream.getInt32(),
      vi: stream.getInt32()
    });
  }

  this.ov = offs;
};

Solid.prototype.loadGeoms = function (stream) {
  var geoms = [];

  for (var i = 0; i < this.gc; ++i) {
    geoms.push({
      mi: stream.getInt32(),
      oi: stream.getInt32(),
      oj: stream.getInt32(),
      ok: stream.getInt32()
    });
  }

  this.gv = geoms;
};

Solid.prototype.loadLumps = function (stream) {
  var lumps = [];

  for (var i = 0; i < this.lc; ++i) {
    lumps.push({
      fl: stream.getInt32(),
      v0: stream.getInt32(),
      vc: stream.getInt32(),
      e0: stream.getInt32(),
      ec: stream.getInt32(),
      g0: stream.getInt32(),
      gc: stream.getInt32(),
      s0: stream.getInt32(),
      sc: stream.getInt32()
    });
  }

  this.lv = lumps;
};

Solid.prototype.loadNodes = function (stream) {
  var nodes = [];

  for (var i = 0; i < this.nc; ++i) {
    nodes.push({
      si: stream.getInt32(),
      ni: stream.getInt32(),
      nj: stream.getInt32(),
      l0: stream.getInt32(),
      lc: stream.getInt32()
    });
  }

  this.nv = nodes;
};

Solid.prototype.loadPaths = function (stream) {
  var P_ORIENTED = 1;

  var paths = [];

  for (var i = 0; i < this.pc; ++i) {
    var path = {};

    path.p = stream.getFloat32Array(3);
    path.t = stream.getFloat32();
    path.pi = stream.getInt32();
    path.f = stream.getInt32();
    path.s = stream.getInt32();

    path.fl = stream.getInt32();

    if (path.fl & P_ORIENTED) {
      path.e = stream.getFloat32Array(4);
    } else {
      path.e = new Float32Array([1.0, 0.0, 0.0, 0.0]);
    }

    paths.push(path);
  }

  this.pv = paths;
};

Solid.prototype.loadBodies = function (stream) {
  var bodies = [];

  for (var i = 0; i < this.bc; ++i) {
    bodies.push({
      pi: stream.getInt32(),
      pj: stream.getInt32(),
      ni: stream.getInt32(),
      l0: stream.getInt32(),
      lc: stream.getInt32(),
      g0: stream.getInt32(),
      gc: stream.getInt32()
    });

    if (bodies[i].pj < 0)
      bodies[i].pj = bodies[i].pi;
  }

  this.bv = bodies;
};

Solid.prototype.loadItems = function (stream) {
  var items = [];

  for (var i = 0; i < this.hc; ++i) {
    items.push({
      p: stream.getFloat32Array(3),
      t: stream.getInt32(),
      n: stream.getInt32()
    });
  }

  this.hv = items;
};

Solid.prototype.loadGoals = function (stream) {
  var goals = [];

  for (var i = 0; i < this.zc; ++i) {
    goals.push({
      p: stream.getFloat32Array(3),
      r: stream.getFloat32()
    });
  }

  this.zv = goals;
};

Solid.prototype.loadJumps = function (stream) {
  var jumps = [];

  for (var i = 0; i < this.jc; ++i) {
    jumps.push({
      p: stream.getFloat32Array(3),
      q: stream.getFloat32Array(3),
      r: stream.getFloat32()
    });
  }

  this.jv = jumps;
};

Solid.prototype.loadSwitches = function (stream) {
  var switches = [];

  for (var i = 0; i < this.xc; ++i) {
    switches.push({
      p: stream.getFloat32Array(3),
      r: stream.getFloat32(),
      pi: stream.getInt32(),
      t: stream.getFloat32Array(2)[0], // Consume unused padding.
      f: stream.getFloat32Array(2)[0], // Consume unused padding.
      i: stream.getInt32()
    });
  }

  this.xv = switches;
};

Solid.prototype.loadBills = function (stream) {
  var bills = [];

  for (var i = 0; i < this.rc; ++i) {
    bills.push({
      fl: stream.getInt32(),
      mi: stream.getInt32(),
      t: stream.getFloat32(),
      d: stream.getFloat32(),

      w: stream.getFloat32Array(3),
      h: stream.getFloat32Array(3),
      rx: stream.getFloat32Array(3),
      ry: stream.getFloat32Array(3),
      rz: stream.getFloat32Array(3),
      p: stream.getFloat32Array(3)
    });
  }

  this.rv = bills;
};

Solid.prototype.loadBalls = function (stream) {
  var balls = [];

  for (var i = 0; i < this.uc; ++i) {
    balls.push({
      p: stream.getFloat32Array(3),
      r: stream.getFloat32()
    });
  }

  this.uv = balls;
};

Solid.prototype.loadViews = function (stream) {
  var views = [];

  for (var i = 0; i < this.wc; ++i) {
    views.push({
      p: stream.getFloat32Array(3),
      q: stream.getFloat32Array(3)
    });
  }

  this.wv = views;
};

Solid.prototype.getBodyGeomsByMtrl = function (body) {
  var geoms = [];

  function addGeomByMtrl(geom) {
    var mi = geom.mi;
    geoms[mi] = geoms[mi] || [];
    geoms[mi].push(geom);
  }

  for (var gi = 0; gi < body.gc; ++gi) {
    addGeomByMtrl(this.gv[this.iv[body.g0 + gi]]);
  }

  for (var li = 0; li < body.lc; ++li) {
    var lump = this.lv[body.l0 + li];
    for (var gi = 0; gi < lump.gc; ++gi) {
      addGeomByMtrl(this.gv[this.iv[lump.g0 + gi]]);
    }
  }

  return geoms;
};

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

Solid.prototype.getBodyMeshes = function (body) {
  var meshes = [];
  var self = this;

  this.getBodyGeomsByMtrl(body).forEach(function (geoms, mi) {
    var mesh = new Mesh(geoms.length * 3, self.mv[mi]);

    geoms.forEach(function (geom) {
      mesh.addVertFromSol(self, self.ov[geom.oi]);
      mesh.addVertFromSol(self, self.ov[geom.oj]);
      mesh.addVertFromSol(self, self.ov[geom.ok]);
    });

    meshes.push(mesh);
  });

  return meshes;
};

Solid.prototype.getView = function () {
  if (this.wv.length)
    return new View(this.wv[0].p, this.wv[0].q);
  else
    return new View();
};

/*----------------------------------------------------------------------------*/

/*
 * Load a SOL file from the given file.
 *
 * IS THIS POINTLESS
 *
 * Generally:
 * 
 * var reader = new SolReader();
 * reader.onload = function () { console.log(this.result); };
 * reader.read(file);
 */
var SolReader = function () {
  this.onload = null;
  this.result = null;
};

SolReader.prototype.read = function (file) {
  var self = this;
  var reader = new FileReader();
  reader.addEventListener('load', function (event) {
    self.result = Solid.load(this.result);
    if (self.onload)
      self.onload.call(self);
  });
  reader.readAsArrayBuffer(file);
};

/*
 * Exports.
 */
module.exports = {
  Solid: Solid,
  SolReader: SolReader
};