'use strict';

var Solid = require('./solid');
var Mover = require('./mover');

Solid.prototype.initDynamicState = function() {
  for (var i = 0; i < this.bv.length; ++i) {
    var body = this.bv[i];
    body.movers = Mover.fromSolBody(this, body);
  }
}

Solid.prototype.step = function(dt) {
  for (var i = 0; i < this.bv.length; ++i) {
    var body = this.bv[i];
    body.step(dt);
  }  
}

module.export = Solid;