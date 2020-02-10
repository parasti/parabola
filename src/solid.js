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
                    p: [0.5 * i, 0.5 * j, 0.5 * k],
                    t: Solid.ITEM_COIN,
                    n: Math.random() * 15
                });
            }
        }
    }

    return sol;
};