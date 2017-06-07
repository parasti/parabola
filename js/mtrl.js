'use strict';

var util = require('./util.js');

var Mtrl = function () {
  this.d = new Float32Array([0.8, 0.8, 0.8, 1.0]);
  this.a = new Float32Array([0.2, 0.2, 0.2, 1.0]);
  this.s = new Float32Array([0, 0, 0, 1]);
  this.e = new Float32Array([0, 0, 0, 1]);
  this.h = new Float32Array([0]);
  this.fl = 0;
  this.f = '';
};

Mtrl.ALPHA_TEST = (1 << 9);

Mtrl.load = function (stream) {
  return (new Mtrl()).load(stream);
};

/*
 * Load material from a DataStream.
 */
Mtrl.prototype.load = function (stream) {
  this.d = stream.getFloat32Array(4);
  this.a = stream.getFloat32Array(4);
  this.s = stream.getFloat32Array(4);
  this.e = stream.getFloat32Array(4);
  this.h = stream.getFloat32Array(1);
  this.fl = stream.getInt32();

  this.f = util.getCString(stream.getUint8Array(64));

  if (this.fl & Mtrl.ALPHA_TEST) {
    this.alpha_func = stream.getInt32();
    this.alpha_ref = stream.getFloat32();
  } else {
    this.alpha_func = 0;
    this.alpha_ref = 0.0;
  }

  return this;
};

Mtrl.prototype.toString = function () {
  return this.f;
};

/*
 * Create a GL texture from the given image.
 */
Mtrl.prototype.createTexture = function (gl, img) {
  var tex = gl.createTexture();

  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_2D, null);

  this.tex = tex;
};

/*
 * Download material image and create a texture.
 */
Mtrl.prototype.loadTexture = function (gl) {
  var self = this;
  var img = new Image();

  img.onload = function () {
    self.createTexture(gl, this);
  };
  img.onerror = function () {
    // TODO, this is dumb and results in lots of 404s.
    // Instead, pre-make a table that maps mtrls to images.
    if (!this.src.endsWith('.png')) {
      this.src = 'data/textures/' + self + '.png';
    }
  };
  img.src = 'data/textures/' + self + '.jpg';
};

/*
 * Exports.
 */
module.exports = Mtrl;