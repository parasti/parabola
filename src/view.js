'use strict';

var vec3 = require('gl-matrix').vec3;
var mat4 = require('gl-matrix').mat4;
var toRadian = require('gl-matrix').glMatrix.toRadian;

module.exports = View;

function View (p, c) {
  if (!(this instanceof View)) {
    return new View(p, c);
  }

  this.p = vec3.create();
  this.c = vec3.create();
  this.u = vec3.fromValues(0, 1, 0);

  if (p && c) {
    vec3.copy(this.p, p);
    vec3.copy(this.c, c);
  } else if (p) {
    this.overhead(p);
  } else {
    this.overhead([0, 0, 0]);
  }

  this._basis = mat4.create();
  this._viewMatrix = mat4.create();
  this._projectionMatrix = mat4.create();

  // TODO
  this.speed = View.SPEED;
  this.backward = false;
  this.forward = false;
  this.left = false;
  this.right = false;
  this._dx = 0.0;
  this._dy = 0.0;
}

/*
 * Compute a Neverball perspective projection matrix.
 */
View.prototype.setProjection = function (w, h, fovAngle) {
  var fov = fovAngle * Math.PI / 180;
  var a = w / h;
  var n = 0.1;
  var f = 512.0;

  mat4.perspective(this._projectionMatrix, fov, a, n, f);
};

/*
 * Neverball defaults
 */
View.DP = 0.75;
View.DC = 0.25;
View.DZ = 2.00;

View.SPEED = 2.0;

/*
 * Overhead at position.
 */
View.prototype.overhead = function (p) {
  vec3.set(this.p, p[0], p[1] + View.DP, p[2] + View.DZ);
  vec3.set(this.c, p[0], p[1] + View.DC, p[2]);
};

/*
 * Calculate a basis matrix.
 */
View.prototype.getBasis = (function () {
  // video_calc_view
  var x = vec3.create();
  var y = vec3.create();
  var z = vec3.create();

  return function () {
    vec3.sub(z, this.p, this.c);
    vec3.normalize(z, z);
    vec3.cross(x, this.u, z);
    vec3.normalize(x, x);
    vec3.cross(y, z, x);

    var M = this._basis;

    M[0] = x[0];
    M[1] = x[1];
    M[2] = x[2];

    M[4] = y[0];
    M[5] = y[1];
    M[6] = y[2];

    M[8] = z[0];
    M[9] = z[1];
    M[10] = z[2];

    return this._basis;
  };
})();

/*
 * Calculate the complete view matrix.
 */
View.prototype.getMatrix = (function () {
  // game_draw
  var M = mat4.create();
  var v = vec3.create();

  return function () {
    var viewMat = this._viewMatrix;

    vec3.sub(v, this.c, this.p);
    mat4.fromTranslation(viewMat, vec3.set(v, 0, 0, -vec3.len(v)));
    mat4.multiply(viewMat, viewMat, mat4.transpose(M, this.getBasis()));
    mat4.translate(viewMat, viewMat, vec3.negate(v, this.c));

    return this._viewMatrix;
  };
})();

View.prototype.fly = (function () {
  // game_view_fly

  var ballView = View();
  var viewView = View();

  return function (ballPosition, viewpoints, k) {
    if (ballPosition) {
      ballView.overhead(ballPosition);
    }

    if (k >= 0 && viewpoints.length > 0) {
      vec3.copy(viewView.p, viewpoints[0].position);
      vec3.copy(viewView.c, viewpoints[0].target);
    }
    if (k <= 0 && viewpoints.length > 1) {
      vec3.copy(viewView.p, viewpoints[1].position);
      vec3.copy(viewView.c, viewpoints[1].target);
    } else if (k <= 0) { // TOOD
      k = 0;
    }

    // Interpolate the views.

    vec3.lerp(this.p, ballView.p, viewView.p, k * k);
    vec3.lerp(this.c, ballView.c, viewView.c, k * k);
  }
})();

/*
 * Rudimentary controls.
 */
View.prototype.moveForward = function (b) {
  this.forward = b;
};

View.prototype.moveBackward = function (b) {
  this.backward = b;
};

View.prototype.moveLeft = function (b) {
  this.left = b;
};

View.prototype.moveRight = function (b) {
  this.right = b;
};

View.prototype.setMoveSpeed = function (dir) {
  if (dir > 0) {
    this.speed = Math.max(View.SPEED, this.speed + View.SPEED);
  } else if (dir < 0) {
    this.speed = Math.max(View.SPEED, this.speed - View.SPEED);
  }
};

View.prototype.step = (function () {
  var v = vec3.create();

  return function (dt) {
    vec3.set(v, 0, 0, 0);

    if (this.forward) {
      v[2] -= this.speed;
    }
    if (this.backward) {
      v[2] += this.speed;
    }
    if (this.left) {
      v[0] -= this.speed;
    }
    if (this.right) {
      v[0] += this.speed;
    }

    if (v[0] || v[2] || v[1]) {
      vec3.transformMat4(v, v, this.getBasis());

      vec3.scale(v, v, dt);
      vec3.add(this.p, this.p, v);
      vec3.add(this.c, this.c, v);
    }
  };
})();

View.prototype.mouseLook = (function () {
  var z = vec3.create();
  var o = vec3.create();

  return function (dx, dy) {
    // dx = rotate around Y
    // dy = rotate around X

    // TODO this does nothing a lot of the time.

    var a = (dx || dy) ? 0.005 : 0.1;
    var filteredDx = (dx * a) + (this._dx * (1.0 - a));
    var filteredDy = (dy * a) + (this._dy * (1.0 - a));
    this._dx = filteredDx;
    this._dy = filteredDy;

    vec3.set(z, 0, 0, 1);
    vec3.set(o, 0, 0, 0);

    if (filteredDx) {
      vec3.rotateY(z, z, o, toRadian(-filteredDx));
    }
    if (filteredDy) {
      vec3.rotateX(z, z, o, toRadian(-filteredDy));
    }

    vec3.transformMat4(z, z, this.getBasis());
    vec3.add(this.c, this.p, vec3.negate(z, z));
  };
})();
