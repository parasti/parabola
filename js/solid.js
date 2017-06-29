'use strict';

var mat4 = require('gl-matrix').mat4;
var vec3 = require('gl-matrix').vec3;
var quat = require('gl-matrix').quat;

var misc = require('./misc.js');
var data = require('./data.js');

var Mtrl = require('./mtrl.js');
var Mesh = require('./mesh.js');
var Body = require('./body.js');
var View = require('./view.js');

/*
 * Neverball SOL file.
 */
function Solid(buffer) {
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
 * Download and parse a SOL file at path (relative to data).
 */
Solid.fetch = function(path, onload) {
  data.fetchBinaryFile(path, function(e) {
    var sol = Solid.load(this.response);
    onload.call(sol, e);
  });
}

/*
 * Load a SOL file from the given ArrayBuffer.
 */
Solid.load = function (buffer) {
  // TODO move to a worker
  var stream = new misc.DataStream(buffer);

  var magic = stream.getInt32();

  if (magic !== Solid.MAGIC) {
    console.error('Failed to load SOL: not a SOL file');
    return;
  }

  var version = stream.getInt32();

  if (version !== Solid.VERSION) {
    console.error('Failed to load SOL: not a version ' + Solid.VERSION + ' SOL file');
    return;
  }

  var ac = stream.getInt32();
  var dc = stream.getInt32();
  var mc = stream.getInt32();
  var vc = stream.getInt32();
  var ec = stream.getInt32();
  var sc = stream.getInt32();
  var tc = stream.getInt32();
  var oc = stream.getInt32();
  var gc = stream.getInt32();
  var lc = stream.getInt32();
  var nc = stream.getInt32();
  var pc = stream.getInt32();
  var bc = stream.getInt32();
  var hc = stream.getInt32();
  var zc = stream.getInt32();
  var jc = stream.getInt32();
  var xc = stream.getInt32();
  var rc = stream.getInt32();
  var uc = stream.getInt32();
  var wc = stream.getInt32();
  var ic = stream.getInt32();

  var sol = new Solid();

  sol.magic = magic;
  sol.version = version;

  sol.av = stream.getUint8Array(ac);
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
  sol.iv = stream.getInt32Array(ic);

  return sol;
};

function loadDicts(stream, count, bytes) {
  var dicts = {};

  for (var i = 0; i < count; ++i) {
    var ai = stream.getInt32();
    var aj = stream.getInt32();

    var key = misc.getCString(bytes, ai);
    var val = misc.getCString(bytes, aj);

    dicts[key] = val;
  }

  return dicts;
};

function loadMtrls(stream, count) {
  var mtrls = [];

  for (var i = 0; i < count; ++i) {
    var mtrl = new Mtrl();

    mtrl.d = stream.getFloat32Array(4);
    mtrl.a = stream.getFloat32Array(4);
    mtrl.s = stream.getFloat32Array(4);
    mtrl.e = stream.getFloat32Array(4);
    mtrl.h = stream.getFloat32Array(1);
    mtrl.fl = stream.getInt32();

    mtrl.f = misc.getCString(stream.getUint8Array(64));

    if (mtrl.fl & Mtrl.ALPHA_TEST) {
      mtrl.alpha_func = stream.getInt32();
      mtrl.alpha_ref = stream.getFloat32();
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
    verts.push(stream.getFloat32Array(3));
  }

  return verts;
};

function loadEdges(stream, count) {
  var edges = [];

  for (var i = 0; i < count; ++i) {
    edges.push({
      vi: stream.getInt32(),
      vj: stream.getInt32()
    });
  }

  return edges;
};

function loadSides(stream, count) {
  var sides = [];

  for (var i = 0; i < count; ++i) {
    sides.push({
      n: stream.getFloat32Array(3),
      d: stream.getFloat32()
    });
  }

  return sides;
};

function loadTexcs(stream, count) {
  var texcs = [];

  for (var i = 0; i < count; ++i) {
    texcs.push(stream.getFloat32Array(2));
  }

  return texcs;
};

function loadOffs(stream, count) {
  var offs = [];

  for (var i = 0; i < count; ++i) {
    offs.push({
      ti: stream.getInt32(),
      si: stream.getInt32(),
      vi: stream.getInt32()
    });
  }

  return offs;
};

function loadGeoms(stream, count) {
  var geoms = [];

  for (var i = 0; i < count; ++i) {
    geoms.push({
      mi: stream.getInt32(),
      oi: stream.getInt32(),
      oj: stream.getInt32(),
      ok: stream.getInt32()
    });
  }

  return geoms;
};

function loadLumps(stream, count) {
  var lumps = [];

  for (var i = 0; i < count; ++i) {
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

  return lumps;
};

function loadNodes(stream, count) {
  var nodes = [];

  for (var i = 0; i < count; ++i) {
    nodes.push({
      si: stream.getInt32(),
      ni: stream.getInt32(),
      nj: stream.getInt32(),
      l0: stream.getInt32(),
      lc: stream.getInt32()
    });
  }

  return nodes;
};

// TODO
function Path() {
}

Path.ORIENTED = 1;

function loadPaths(stream, count) {
  var paths = [];

  for (var i = 0; i < count; ++i) {
    var path = new Path();

    path.p = stream.getFloat32Array(3);
    path.t = stream.getFloat32();
    path.pi = stream.getInt32();
    path.f = stream.getInt32();
    path.s = stream.getInt32();

    path.fl = stream.getInt32();

    if (path.fl & Path.ORIENTED) {
      // Neverball quaternions are the other way around.
      var e = stream.getFloat32Array(4);
      path.e = quat.fromValues(e[1], e[2], e[3], e[0]);
    } else {
      path.e = quat.create();
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
    var body = new Body();

    body.pi = stream.getInt32();
    body.pj = stream.getInt32();
    body.ni = stream.getInt32();
    body.l0 = stream.getInt32();
    body.lc = stream.getInt32();
    body.g0 = stream.getInt32();
    body.gc = stream.getInt32();

    if (body.pj < 0)
      body.pj = body.pi;

    bodies.push(body);
  }

  return bodies;
};

function loadItems(stream, count) {
  var items = [];

  for (var i = 0; i < count; ++i) {
    items.push({
      p: stream.getFloat32Array(3),
      t: stream.getInt32(),
      n: stream.getInt32()
    });
  }

  return items;
};

function loadGoals(stream, count) {
  var goals = [];

  for (var i = 0; i < count; ++i) {
    goals.push({
      p: stream.getFloat32Array(3),
      r: stream.getFloat32()
    });
  }

  return goals;
};

function loadJumps(stream, count) {
  var jumps = [];

  for (var i = 0; i < count; ++i) {
    jumps.push({
      p: stream.getFloat32Array(3),
      q: stream.getFloat32Array(3),
      r: stream.getFloat32()
    });
  }

  return jumps;
};

function loadSwitches(stream, count) {
  var switches = [];

  for (var i = 0; i < count; ++i) {
    switches.push({
      p: stream.getFloat32Array(3),
      r: stream.getFloat32(),
      pi: stream.getInt32(),
      t: stream.getFloat32Array(2)[0], // Consume unused padding.
      f: stream.getFloat32Array(2)[0], // Consume unused padding.
      i: stream.getInt32()
    });
  }

  return switches;
};

function loadBills(stream, count) {
  var bills = [];

  for (var i = 0; i < count; ++i) {
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

  return bills;
};

function loadBalls(stream, count) {
  var balls = [];

  for (var i = 0; i < count; ++i) {
    balls.push({
      p: stream.getFloat32Array(3),
      r: stream.getFloat32()
    });
  }

  return balls;
};

function loadViews(stream, count) {
  var views = [];

  for (var i = 0; i < count; ++i) {
    views.push({
      p: stream.getFloat32Array(3),
      q: stream.getFloat32Array(3)
    });
  }

  return views;
};

/*
 * Exports.
 */
module.exports = Solid;