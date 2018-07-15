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
  var i;

  for (i = 0; i < this.children.length; ++i) {
    this.children[i]._markDirty();
  }

  for (i = 0; i < this.instances.length; ++i) {
    this.instances[i]._markDirty();
  }

  this.dirty = true;
};

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

    if (s.length) {
      mat4.fromRotationTranslationScale(this.localMatrix, e, p, s);
    } else {
      vec3.set(s_, s, s, s);
      mat4.fromRotationTranslationScale(this.localMatrix, e, p, s_);
    }
    this._markDirty();
  };
})();

/*
 * Update and return the world matrix of this node.
 */
SceneNode.prototype.getWorldMatrix = function () {
  this._update();
  return this.worldMatrix;
};

/*
 * Test the given node for ancestry.
 */
SceneNode.prototype.hasAncestor = function (node) {
  if (node === null) {
    return false;
  } else {
    return this.parent && (this.parent === node || this.parent.hasAncestor(node));
  }
};

/*
 * Set node parent.
 */
SceneNode.prototype.setParent = function (node) {
  if (this === node || this.hasAncestor(node)) {
    throw Error('Can not parent node to itself');
  }

  if (this.parent) {
    removeFromList(this.parent.children, this);
  }

  this.parent = node;
  this.dirty = true;

  if (node) {
    addToList(node.children, this);

    if (this.worldMatrix === this.localMatrix) {
      // We are now a child node, no longer sharing matrices.
      this.worldMatrix = this._worldMatrix;
    }
  } else {
    // We are now a root node, sharing matrices.
    this.worldMatrix = this.localMatrix;
  }
};

/*
 * Use the localMatrix of the given node.
 */
SceneNode.prototype._setMaster = function (node) {
  if (this.master) {
    removeFromList(this.master.instances, this);
  }

  this.master = node;
  this.dirty = true;

  if (node) {
    addToList(node.instances, this);
  }
};

/*
 * Find the one true master.
 */
SceneNode.prototype.getMaster = function () {
  if (this.master) {
    return this.master;
  }
  if (this.parent) {
    return this.parent.getMaster();
  }
  return null;
}

/*
 * Create an instance of this node.
 */
SceneNode.prototype.createInstance = function () {
  var node = SceneNode();
  var master = this.getMaster() || this;

  node._setMaster(master);

  // Create instances of all children and parent them to this node.

  for (var i = 0; i < this.children.length; ++i) {
    var child = this.children[i].createInstance();
    child.setParent(node);
  }

  return node;
};

/*
 * Unlink node from its parent and master nodes.
 */
SceneNode.prototype.unlink = function () {
  this._setMaster(null);
  this.setParent(null);
};

/*
 * Add unique object to list.
 */
function addToList (list, obj) {
  var index = list.indexOf(obj);
  if (index < 0) {
    list.push(obj);
  }
}

/*
 * Remove matching object from list.
 */
function removeFromList (list, obj) {
  var index = list.indexOf(obj);
  if (index >= 0) {
    list.splice(index, 1);
  }
}

/*
 * Return the effective local matrix of this node.
 */
SceneNode.prototype._getLocalMatrix = function () {
  if (this.master) {
    return this.master._getLocalMatrix();
  } else {
    return this.localMatrix;
  }
};

/*
 * Update world matrices of this and any parent/master nodes.
 */
SceneNode.prototype._update = function () {
  if (this.dirty) {
    var parent = this.parent;

    if (parent) {
      mat4.multiply(this.worldMatrix, parent.getWorldMatrix(), this._getLocalMatrix());
    } else if (this.master || this.worldMatrix !== this.localMatrix) {
      mat4.copy(this.worldMatrix, this._getLocalMatrix());
    }

    this.dirty = false;
  }
};
