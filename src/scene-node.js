'use strict';

var vec3 = require('gl-matrix').vec3;
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
  // Root nodes start out with a shared local/world matrix.
  this.worldMatrix = this.localMatrix;
  // Pre-allocate a separate matrix in case we get parented.
  this._worldMatrix = mat4.create();

  // Instances use the localMatrix of a master node.
  this.master = null;
  this.instances = [];

  if (parent !== undefined) {
    this.setParent(parent);
  }
}

/*
 * Mark this tree of nodes for update.
 */
SceneNode.prototype._markDirty = function () {
  var i = 0;

  for (i = 0; i < this.children.length; ++i) {
    this.children[i]._markDirty();
  }

  for (i = 0; i <  this.instances.length; ++i) {
    this.instances[i]._markDirty();
  }

  this.dirty = true;
}

/*
 * Set local matrix from given position vector, rotation quaternion and scale.
 */
SceneNode.prototype.setLocalMatrix = (function () {
  // Preallocate.
  var s_ = vec3.create();

  return function (p, e, s) {
    if (this.master) {
      throw Error('Can not set the local matrix of a node instance');
    }

    vec3.set(s_, s, s, s);
    mat4.fromRotationTranslationScale(this.localMatrix, e, p, s_);
    this._markDirty();
  }
})();

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

/*
 * Create an instance of this node.
 */
SceneNode.prototype.createInstance = function (parent) {
  var inst = SceneNode(parent);

  inst.master = this;
  this.instances.push(inst);

  // Create instances of all children and parent them to this instance.

  for (var i = 0; i < this.children.length; ++i) {
    var childInst = this.children[i].createInstance(inst);
    childInst.setParent(inst);
  }

  return inst;
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

SceneNode.prototype.getLocalMatrix = function () {
  if (this.master) {
    return this.master.getLocalMatrix();
  } else {
    return this.localMatrix;
  }
}

SceneNode.prototype._update = function () {
  if (this.master) {
    this.master._update();
  }

  if (this.dirty) {
    var parent = this.parent;

    if (parent) {
      parent._update();
      mat4.multiply(this.worldMatrix, parent.worldMatrix, this.getLocalMatrix());
    }

    this.dirty = false;
  }
}