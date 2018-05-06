'use strict';

var mat4 = require('gl-matrix').mat4;

module.exports = SceneNode;

function SceneNode (parent) {
  if (!(this instanceof SceneNode)) {
    return new SceneNode(parent);
  }

  this.parent = null;
  this.children = [];
  this.dirty = true;

  this.localMatrix = mat4.create();
  // Root nodes start out sharing matrices.
  this.worldMatrix = this.localMatrix;
  // Pre-allocate one in case we get parented.
  this._worldMatrix = mat4.create();

  if (parent !== undefined) {
    this.setParent(parent);
  }
}

/*
 * Mark this tree of nodes for update.
 */
SceneNode.prototype.markDirty = function () {
  for (var i = 0; i < this.children.length; ++i) {
    this.children[i].markDirty();
  }

  this.dirty = true;
}

/*
 * Get local matrix.
 */
SceneNode.prototype.getLocalMatrix = function () {
  return this.localMatrix;
}

/*
 * Get the world matrix of this node, updating it first.
 */
SceneNode.prototype.getWorldMatrix = function () {
  this._update();
  return this.worldMatrix;
}

/*
 * Set node parent.
 */
SceneNode.prototype.setParent = function (node) {
  if (this.parent) {
    this.parent._removeChild(this);
  }

  this.parent = node;
  this.dirty = true;

  if (node) {
    node._addChild(this);

    if (this.worldMatrix === this.localMatrix) {
      // We are now a child node, no longer sharing matrices.
      this.worldMatrix = this._worldMatrix;
    }
  } else {
    // We are now a root node, sharing matrices.
    this.worldMatrix = this.localMatrix;
  }
}

SceneNode.prototype._addChild = function (node) {
  var index = this.children.indexOf(node);
  if (index < 0) {
    this.children.push(node);
  }
}

SceneNode.prototype._removeChild = function (node) {
  var index = this.children.indexOf(node);
  if (index >= 0) {
    this.children.splice(index, 1);
  }
}

SceneNode.prototype._update = function () {
  if (this.dirty) {
    var parent = this.parent;

    if (parent) {
      parent._update();
      mat4.multiply(this.worldMatrix, parent.worldMatrix, this.localMatrix);
    }

    this.dirty = false;
  }
}