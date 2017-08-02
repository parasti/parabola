'use strict';

var SolidCursor = require('cursor').extend({
  readFloatLEArray: function (length) {
    var value = new Float32Array(length);
    for (var i = 0; i < length; ++i)
      value[i] = this.readFloatLE();
    return value;
  },

  readInt32LEArray: function (length) {
   var value = new Int32Array(length);
   for (var i = 0; i < length; ++i)
     value[i] = this.readInt32LE();
   return value;
  }
});

var Mtrl = require('./mtrl.js');

/*
 * Neverball SOL file.
 */
function Solid() {
  this.magic = 0;
  this.version = 0;

  this.av = null;
  this.dv = null;
  this.mv = null;
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
  var stream = SolidCursor(buffer);

  var magic = stream.readInt32LE();

  if (magic !== Solid.MAGIC) {
    console.error('Failed to load SOL: not a SOL file');
    return;
  }

  var version = stream.readInt32LE();

  if (version !== Solid.VERSION) {
    console.error('Failed to load SOL: not a version ' + Solid.VERSION + ' SOL file');
    return;
  }

  var ac = stream.readInt32LE();
  var dc = stream.readInt32LE();
  var mc = stream.readInt32LE();
  var vc = stream.readInt32LE();
  var ec = stream.readInt32LE();
  var sc = stream.readInt32LE();
  var tc = stream.readInt32LE();
  var oc = stream.readInt32LE();
  var gc = stream.readInt32LE();
  var lc = stream.readInt32LE();
  var nc = stream.readInt32LE();
  var pc = stream.readInt32LE();
  var bc = stream.readInt32LE();
  var hc = stream.readInt32LE();
  var zc = stream.readInt32LE();
  var jc = stream.readInt32LE();
  var xc = stream.readInt32LE();
  var rc = stream.readInt32LE();
  var uc = stream.readInt32LE();
  var wc = stream.readInt32LE();
  var ic = stream.readInt32LE();

  var sol = new Solid();

  sol.magic = magic;
  sol.version = version;

  sol.av = stream.slice(ac).buffer();
  sol.dv = loadDicts(stream, dc, sol.av);
  sol.mv = loadMtrls(stream, mc);
  sol.vv = loadVerts(stream, vc);
  sol.ev = loadEdges(stream, ec);
  sol.sv = loadSides(stream, sc);
  sol.tv = loadTexcs(stream, tc);
  sol.ov = loadOffs(stream, oc);
  sol.gv = loadGeoms(stream, gc);
  sol.lv = loadLumps(stream, lc);
  sol.nv = loadNodes(stream, nc);
  sol.pv = loadPaths(stream, pc);
  sol.bv = loadBodies(stream, bc);
  sol.hv = loadItems(stream, hc);
  sol.zv = loadGoals(stream, zc);
  sol.jv = loadJumps(stream, jc);
  sol.xv = loadSwitches(stream, xc);
  sol.rv = loadBills(stream, rc);
  sol.uv = loadBalls(stream, uc);
  sol.wv = loadViews(stream, wc);
  sol.iv = stream.readInt32LEArray(ic);

  return sol;
};

function loadDicts(stream, count, byteBuffer) {
  var dicts = {};

  for (var i = 0; i < count; ++i) {
    var ai = stream.readInt32LE();
    var aj = stream.readInt32LE();

    var key = byteBuffer.toString('utf8', ai, byteBuffer.indexOf(0, ai));
    var val = byteBuffer.toString('utf8', aj, byteBuffer.indexOf(0, aj));

    dicts[key] = val;
  }

  return dicts;
};

function loadMtrls(stream, count) {
  var mtrls = [];

  for (var i = 0; i < count; ++i) {
    var mtrl = new Mtrl();

    mtrl.d = stream.readFloatLEArray(4);
    mtrl.a = stream.readFloatLEArray(4);
    mtrl.s = stream.readFloatLEArray(4);
    mtrl.e = stream.readFloatLEArray(4);
    mtrl.h = stream.readFloatLEArray(1);
    mtrl.fl = stream.readInt32LE();

    var byteBuffer = stream.slice(64).buffer();
    mtrl.f = byteBuffer.toString('utf8', 0, byteBuffer.indexOf(0));

    if (mtrl.fl & Mtrl.ALPHA_TEST) {
      mtrl.alpha_func = stream.readInt32LE();
      mtrl.alpha_ref = stream.readFloatLE();
    } else {
      mtrl.alpha_func = 0;
      mtrl.alpha_ref = 0.0;
    }

    mtrls.push(mtrl);
  }

  return mtrls;
};

function loadVerts(stream, count) {
  var verts = [];

  for (var i = 0; i < count; ++i) {
    verts.push(stream.readFloatLEArray(3));
  }

  return verts;
};

function loadEdges(stream, count) {
  var edges = [];

  for (var i = 0; i < count; ++i) {
    edges.push({
      vi: stream.readInt32LE(),
      vj: stream.readInt32LE()
    });
  }

  return edges;
};

function loadSides(stream, count) {
  var sides = [];

  for (var i = 0; i < count; ++i) {
    sides.push({
      n: stream.readFloatLEArray(3),
      d: stream.readFloatLE()
    });
  }

  return sides;
};

function loadTexcs(stream, count) {
  var texcs = [];

  for (var i = 0; i < count; ++i) {
    texcs.push(stream.readFloatLEArray(2));
  }

  return texcs;
};

function loadOffs(stream, count) {
  var offs = [];

  for (var i = 0; i < count; ++i) {
    offs.push({
      ti: stream.readInt32LE(),
      si: stream.readInt32LE(),
      vi: stream.readInt32LE()
    });
  }

  return offs;
};

function loadGeoms(stream, count) {
  var geoms = [];

  for (var i = 0; i < count; ++i) {
    geoms.push({
      mi: stream.readInt32LE(),
      oi: stream.readInt32LE(),
      oj: stream.readInt32LE(),
      ok: stream.readInt32LE()
    });
  }

  return geoms;
};

function loadLumps(stream, count) {
  var lumps = [];

  for (var i = 0; i < count; ++i) {
    lumps.push({
      fl: stream.readInt32LE(),
      v0: stream.readInt32LE(),
      vc: stream.readInt32LE(),
      e0: stream.readInt32LE(),
      ec: stream.readInt32LE(),
      g0: stream.readInt32LE(),
      gc: stream.readInt32LE(),
      s0: stream.readInt32LE(),
      sc: stream.readInt32LE()
    });
  }

  return lumps;
};

function loadNodes(stream, count) {
  var nodes = [];

  for (var i = 0; i < count; ++i) {
    nodes.push({
      si: stream.readInt32LE(),
      ni: stream.readInt32LE(),
      nj: stream.readInt32LE(),
      l0: stream.readInt32LE(),
      lc: stream.readInt32LE()
    });
  }

  return nodes;
};

function loadPaths(stream, count) {
  const P_ORIENTED = 0x1;

  var paths = [];

  for (var i = 0; i < count; ++i) {
    var path = {
      p: stream.readFloatLEArray(3),
      t: stream.readFloatLE(),
      pi: stream.readInt32LE(),
      f: stream.readInt32LE(),
      s: stream.readInt32LE(),
      fl: stream.readInt32LE()
    };

    if (path.fl & P_ORIENTED) {
      var e = stream.readFloatLEArray(4);

      // Convert Neverball's W X Y Z to glMatrix's X Y Z W.
      var w = e[0];

      e[0] = e[1];
      e[1] = e[2];
      e[2] = e[3];
      e[3] = w;

      // Orientation quaternion.
      path.e = e;
    } else {
      // Identity quaternion.
      path.e = new Float32Array([0, 0, 0, 1]);
    }

    paths.push(path);
  }

  // Translate.

  for (var i = 0; i < paths.length; ++i) {
    var path = paths[i];
    // May link to itself.
    path.next = paths[path.pi] || null;
  }

  return paths;
};

function loadBodies(stream, count) {
  var bodies = [];

  for (var i = 0; i < count; ++i) {
    bodies.push({
      pi: stream.readInt32LE(),
      pj: stream.readInt32LE(),
      ni: stream.readInt32LE(),
      l0: stream.readInt32LE(),
      lc: stream.readInt32LE(),
      g0: stream.readInt32LE(),
      gc: stream.readInt32LE()
    });

    if (bodies[i].pj < 0)
      bodies[i].pj = bodies[i].pi;
  }

  return bodies;
};

function loadItems(stream, count) {
  var items = [];

  for (var i = 0; i < count; ++i) {
    items.push({
      p: stream.readFloatLEArray(3),
      t: stream.readInt32LE(),
      n: stream.readInt32LE()
    });
  }

  return items;
};

function loadGoals(stream, count) {
  var goals = [];

  for (var i = 0; i < count; ++i) {
    goals.push({
      p: stream.readFloatLEArray(3),
      r: stream.readFloatLE()
    });
  }

  return goals;
};

function loadJumps(stream, count) {
  var jumps = [];

  for (var i = 0; i < count; ++i) {
    jumps.push({
      p: stream.readFloatLEArray(3),
      q: stream.readFloatLEArray(3),
      r: stream.readFloatLE()
    });
  }

  return jumps;
};

function loadSwitches(stream, count) {
  var switches = [];

  for (var i = 0; i < count; ++i) {
    switches.push({
      p: stream.readFloatLEArray(3),
      r: stream.readFloatLE(),
      pi: stream.readInt32LE(),
      t: stream.readFloatLEArray(2)[0], // Consume unused padding.
      f: stream.readFloatLEArray(2)[0], // Consume unused padding.
      i: stream.readInt32LE()
    });
  }

  return switches;
};

function loadBills(stream, count) {
  var bills = [];

  for (var i = 0; i < count; ++i) {
    bills.push({
      fl: stream.readInt32LE(),
      mi: stream.readInt32LE(),
      t: stream.readFloatLE(),
      d: stream.readFloatLE(),

      w: stream.readFloatLEArray(3),
      h: stream.readFloatLEArray(3),
      rx: stream.readFloatLEArray(3),
      ry: stream.readFloatLEArray(3),
      rz: stream.readFloatLEArray(3),
      p: stream.readFloatLEArray(3)
    });
  }

  return bills;
};

function loadBalls(stream, count) {
  var balls = [];

  for (var i = 0; i < count; ++i) {
    balls.push({
      p: stream.readFloatLEArray(3),
      r: stream.readFloatLE()
    });
  }

  return balls;
};

function loadViews(stream, count) {
  var views = [];

  for (var i = 0; i < count; ++i) {
    views.push({
      p: stream.readFloatLEArray(3),
      q: stream.readFloatLEArray(3)
    });
  }

  return views;
};

/*
 * Index body geoms by SOL material ID. The result is a sparse array.
 */
function indexGeomByMtrl(geoms, geom) {
  var mi = geom.mi;

  if (!geoms[mi])
    geoms[mi] = [];

  geoms[mi].push(geom);
}

Solid.prototype.getBodyGeomsByMtrl = function (body) {
  var geoms = [];

  // OBJ geometry.
  for (var gi = 0; gi < body.gc; ++gi) {
    indexGeomByMtrl(geoms, this.gv[this.iv[body.g0 + gi]]);
  }

  // Lump geometry.
  for (var li = 0; li < body.lc; ++li) {
    var lump = this.lv[body.l0 + li];
    for (var gi = 0; gi < lump.gc; ++gi) {
      indexGeomByMtrl(geoms, this.gv[this.iv[lump.g0 + gi]]);
    }
  }

  return geoms;
};

/*
 * Collect vertex attributes described by a SOL offs into a Float32Array[8] (position+normal+uv).
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

function addVertToMesh(mesh, sol, offs) {
  var pos = mesh.count * 8;
  var vert = mesh.verts.subarray(pos, pos + 8);

  sol.getVert(vert, offs);

  mesh.count++;
};

/*
 * Create a list of meshes from a SOL body, mesh per each used material.
 */
Solid.prototype.getBodyMeshes = function (body) {
  var meshes = [];
  var sol = this;

  this.getBodyGeomsByMtrl(body).forEach(function (geoms, mi) {
    var mesh = {
      mtrl: sol.mv[mi],
      // 1 geom = 3 verts = 3 * (3 + 3 + 2) floats
      verts: new Float32Array(geoms.length * 3 * 8),
      count: 0
    };

    for (var i = 0; i < geoms.length; ++i) {
      var geom = geoms[i];

      addVertToMesh(mesh, sol, sol.ov[geom.oi]);
      addVertToMesh(mesh, sol, sol.ov[geom.oj]);
      addVertToMesh(mesh, sol, sol.ov[geom.ok]);
    }

    meshes.push(mesh);
  });

  return meshes;
};

/*
 * Exports.
 */
module.exports = Solid;