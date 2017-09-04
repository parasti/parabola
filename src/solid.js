'use strict';

module.exports = Solid;

/*
 * Buffer with a cursor and array extensions.
 */
var SolidCursor = require('cursor').extend({
  readFloatLEArray: function (length) {
    var value = new Float32Array(length);
    for (var i = 0; i < length; ++i) {
      value[i] = this.readFloatLE();
    }
    return value;
  },

  readInt32LEArray: function (length) {
    var value = new Int32Array(length);
    for (var i = 0; i < length; ++i) {
      value[i] = this.readInt32LE();
    }
    return value;
  }
});

/*
 * Neverball SOL file.
 */
function Solid () {
  return Object.create(Solid.prototype);
}

Solid.MAGIC = 0x4c4f53af;
Solid.VERSIONS = [7, 8];

/*
 * Material type flags.
 */
Solid.MTRL_LIT = (1 << 11);
Solid.MTRL_PARTICLE = (1 << 10);
Solid.MTRL_ALPHA_TEST = (1 << 9);
Solid.MTRL_REFLECTIVE = (1 << 8);
Solid.MTRL_TRANSPARENT = (1 << 7);
Solid.MTRL_SHADOWED = (1 << 6);
Solid.MTRL_DECAL = (1 << 5);
Solid.MTRL_ENVIRONMENT = (1 << 4);
Solid.MTRL_TWO_SIDED = (1 << 3);
Solid.MTRL_ADDITIVE = (1 << 2);
Solid.MTRL_CLAMP_S = (1 << 1);
Solid.MTRL_CLAMP_T = (1 << 0);

/*
 * Billboard flags.
 */
Solid.BILL_EDGE = 1;
Solid.BILL_FLAT = 2;
Solid.BILL_NOFACE = 4;

/*
 * Lump flags.
 */
Solid.LUMP_DETAIL = 1;

/*
 * Item types.
 */
Solid.ITEM_COIN = 1;
Solid.ITEM_GROW = 2;
Solid.ITEM_SHRINK = 3;

/*
 * Path flags.
 */
Solid.PATH_ORIENTED = 1;

/*
 * Load a SOL file from the given ArrayBuffer.
 */
Solid.load = function (buffer) {
  // TODO move to a worker
  var stream = SolidCursor(buffer);

  var magic = stream.readInt32LE();

  if (magic !== Solid.MAGIC) {
    throw Error('Failed to load SOL: not a SOL file');
  }

  var version = stream.readInt32LE();

  if (!Solid.VERSIONS.includes(version)) {
    throw Error('Failed to load SOL: version ' + version + ' is not supported');
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

  var sol = Solid();

  sol.version = version;

  sol.av = sol.bytes = Buffer.from(stream.slice(ac).buffer()); // Realloc.
  sol.dv = sol.dicts = loadDicts(stream, dc, sol.av);
  sol.mv = sol.mtrls = loadMtrls(stream, mc);
  sol.vv = sol.verts = loadVerts(stream, vc);
  sol.ev = sol.edges = loadEdges(stream, ec);
  sol.sv = sol.sides = loadSides(stream, sc);
  sol.tv = sol.texcs = loadTexcs(stream, tc);
  sol.ov = sol.offs = loadOffs(stream, oc);
  sol.gv = sol.geoms = loadGeoms(stream, gc);
  sol.lv = sol.lumps = loadLumps(stream, lc);
  sol.nv = sol.nodes = loadNodes(stream, nc);
  sol.pv = sol.paths = loadPaths(stream, pc);
  sol.bv = sol.bodies = loadBodies(stream, bc);
  sol.hv = sol.items = loadItems(stream, hc);
  sol.zv = sol.goals = loadGoals(stream, zc);
  sol.jv = sol.jumps = loadJumps(stream, jc);
  sol.xv = sol.switches = loadSwitches(stream, xc);
  sol.rv = sol.bills = loadBills(stream, rc);
  sol.uv = sol.balls = loadBalls(stream, uc);
  sol.wv = sol.views = loadViews(stream, wc);
  sol.iv = sol.indices = stream.readInt32LEArray(ic);

  if (sol.version <= 7) {
    var i;
    for (i = 0; i < sol.mv.length; ++i) sol.mv[i].fl |= Solid.MTRL_LIT;
    for (i = 0; i < sol.rv.length; ++i) sol.mv[sol.rv[i].mi].fl &= ~Solid.MTRL_LIT;
  }

  return sol;
};

function loadDicts (stream, count, byteBuffer) {
  var dicts = {};

  for (var i = 0; i < count; ++i) {
    var ai = stream.readInt32LE();
    var aj = stream.readInt32LE();

    var key = byteBuffer.toString('utf8', ai, byteBuffer.indexOf(0, ai));
    var val = byteBuffer.toString('utf8', aj, byteBuffer.indexOf(0, aj));

    dicts[key] = val;
  }

  return dicts;
}

function loadMtrls (stream, count) {
  var mtrls = [];

  for (var i = 0; i < count; ++i) {
    var mtrl = {
      d: stream.readFloatLEArray(4),
      a: stream.readFloatLEArray(4),
      s: stream.readFloatLEArray(4),
      e: stream.readFloatLEArray(4),
      h: stream.readFloatLE(),
      fl: stream.readInt32LE()
    };

    var byteBuffer = stream.slice(64).buffer();
    mtrl.f = byteBuffer.toString('utf8', 0, byteBuffer.indexOf(0));

    if (mtrl.fl & Solid.MTRL_ALPHA_TEST) {
      mtrl.alphaFunc = stream.readInt32LE();
      mtrl.alphaRef = stream.readFloatLE();
    } else {
      mtrl.alphaFunc = 0;
      mtrl.alphaRef = 0.0;
    }

    mtrls.push(mtrl);
  }

  return mtrls;
}

function loadVerts (stream, count) {
  var verts = [];

  for (var i = 0; i < count; ++i) {
    verts.push(stream.readFloatLEArray(3));
  }

  return verts;
}

function loadEdges (stream, count) {
  var edges = [];

  for (var i = 0; i < count; ++i) {
    edges.push({
      vi: stream.readInt32LE(),
      vj: stream.readInt32LE()
    });
  }

  return edges;
}

function loadSides (stream, count) {
  var sides = [];

  for (var i = 0; i < count; ++i) {
    sides.push({
      n: stream.readFloatLEArray(3),
      d: stream.readFloatLE()
    });
  }

  return sides;
}

function loadTexcs (stream, count) {
  var texcs = [];

  for (var i = 0; i < count; ++i) {
    texcs.push(stream.readFloatLEArray(2));
  }

  return texcs;
}

function loadOffs (stream, count) {
  var offs = [];

  for (var i = 0; i < count; ++i) {
    offs.push({
      ti: stream.readInt32LE(),
      si: stream.readInt32LE(),
      vi: stream.readInt32LE()
    });
  }

  return offs;
}

function loadGeoms (stream, count) {
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
}

function loadLumps (stream, count) {
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
}

function loadNodes (stream, count) {
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
}

function loadPaths (stream, count) {
  var paths = [];

  var i, path;

  for (i = 0, path; i < count; ++i) {
    path = {
      p: stream.readFloatLEArray(3),
      t: stream.readFloatLE(),
      pi: stream.readInt32LE(),
      f: stream.readInt32LE(),
      s: stream.readInt32LE(),
      fl: stream.readInt32LE()
    };

    if (path.fl & Solid.PATH_ORIENTED) {
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

  for (i = 0, path; i < paths.length; ++i) {
    path = paths[i];
    // May link to itself.
    path.next = paths[path.pi] || null;
  }

  return paths;
}

function loadBodies (stream, count) {
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

    if (bodies[i].pj < 0) {
      bodies[i].pj = bodies[i].pi;
    }
  }

  return bodies;
}

function loadItems (stream, count) {
  var items = [];

  for (var i = 0; i < count; ++i) {
    items.push({
      p: stream.readFloatLEArray(3),
      t: stream.readInt32LE(),
      n: stream.readInt32LE()
    });
  }

  return items;
}

function loadGoals (stream, count) {
  var goals = [];

  for (var i = 0; i < count; ++i) {
    goals.push({
      p: stream.readFloatLEArray(3),
      r: stream.readFloatLE()
    });
  }

  return goals;
}

function loadJumps (stream, count) {
  var jumps = [];

  for (var i = 0; i < count; ++i) {
    jumps.push({
      p: stream.readFloatLEArray(3),
      q: stream.readFloatLEArray(3),
      r: stream.readFloatLE()
    });
  }

  return jumps;
}

function loadSwitches (stream, count) {
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
}

function loadBills (stream, count) {
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
}

function loadBalls (stream, count) {
  var balls = [];

  for (var i = 0; i < count; ++i) {
    balls.push({
      p: stream.readFloatLEArray(3),
      r: stream.readFloatLE()
    });
  }

  return balls;
}

function loadViews (stream, count) {
  var views = [];

  for (var i = 0; i < count; ++i) {
    views.push({
      p: stream.readFloatLEArray(3),
      q: stream.readFloatLEArray(3)
    });
  }

  return views;
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
Solid.prototype.getBodyMeshes = function (body) {
  var meshes = [];
  var sol = this;

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
};
