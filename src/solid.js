'use strict';

/**
 * neverball-solid with extensions.
 */
var Solid = module.exports = require('neverball-solid');

/**
 * Billboard flag to indicate a background billboard.
 *
 * Not in Neverball.
 */
Solid.BILL_BACK = 0x10;

/**
 * Material flag for a two-pass back-face-first/front-face-second render.
 *
 * Not in Neverball.
 */
Solid.MTRL_TWO_SIDED_SEPARATE = (1 << 12);

/**
 * Create an empty SOL.
 */
Solid.empty = function () {
    var sol = {};

    sol.version = 8;

    sol.av = sol.bytes = [];
    sol.dv = sol.dicts = [];
    sol.mv = sol.mtrls = [];
    sol.vv = sol.verts = [];
    sol.ev = sol.edges = [];
    sol.sv = sol.sides = [];
    sol.tv = sol.texcs = [];
    sol.ov = sol.offs = [];
    sol.gv = sol.geoms = [];
    sol.lv = sol.lumps = [];
    sol.nv = sol.nodes = [];
    sol.pv = sol.paths = [];
    sol.bv = sol.bodies = [];
    sol.hv = sol.items = [];
    sol.zv = sol.goals = [];
    sol.jv = sol.jumps = [];
    sol.xv = sol.switches = [];
    sol.rv = sol.bills = [];
    sol.uv = sol.balls = [];
    sol.wv = sol.views = [];
    sol.iv = sol.indices = [];

    return sol;
}

Solid.genTestMap = function () {
    var sol = Solid.empty();

    for (var i = 0; i < 20; ++i) {
        for (var j = 0; j < 20; ++j) {
            for (var k = 0; k < 20; ++k) {
                sol.items.push({
                    p: [Math.random() * 25, Math.random() * 25, Math.random() * 25],
                    t: Math.random() > 0.5 ? Solid.ITEM_COIN : (Math.random() > 0.5 ? Solid.ITEM_GROW : Solid.ITEM_SHRINK),
                    n: Math.random() * 15
                });
            }
        }
    }

    return sol;
};

Solid.genTestMap2 = function () {
    var sol = Solid.empty();

    sol.balls.push({
        p: [0, 0, 0],
        r: 0.25
    });

    return sol;
};