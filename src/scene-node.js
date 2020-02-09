'use strict';

var vec3 = require('gl-matrix').vec3;
var mat4 = require('gl-matrix').mat4;

var utils = require('./utils.js');

module.exports = SceneNode;

var _nodeIndex = 0;

/**
 * This is a scene graph. A scene graph can serve many
 * purposes, but this one does one thing and one thing only:
 * it calculates the modelview matrices of its nodes. You
 * can create a hierarchy of a bunch of nodes, set their
 * local matrices whichever way you like, and then ask any
 * of them about their complete world matrix.
 *
 * As an extension of this, any node can be "instanced".
 * Such a node or "instance" has no local matrix, instead
 * it becomes a sort-of a puppet and uses the local matrix
 * of its "master" node. Such an instance can then be inserted
 * elsewhere in the scene node graph.
 */
function SceneNode(parent) {
  if (!(this instanceof SceneNode)) {
    return new SceneNode(parent);
  }

  this._id = 'node_' + (_nodeIndex++);

  this.parent = null;
  this.children = [];

  // Does the world matrix need to be updated?
  this.dirty = true;

  this.localMatrix = mat4.create();
  // Root nodes start out with a shared local/world matrix.
  this.worldMatrix = this.localMatrix;
  // Pre-allocate a separate matrix in case we get parented.
  this._worldMatrix = mat4.create();

  // Instances use the localMatrix of a master node.
  this.master = null;
  this.instances = [];

  // Getting world matrices of instances is a common use case.
  this._instanceMatrices = new Float32Array(16);
  this.instanceMatrices = this._instanceMatrices;

  if (parent !== undefined) {
    this.setParent(parent);
  }
}

/**
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

/**
 * Set local matrix given a position vector, rotation quaternion and scale.
 *
 * Scale can be either a scalar or an array.
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

/**
 * Update and return the world matrix of this node.
 */
SceneNode.prototype.getWorldMatrix = function () {
  this._update();
  return this.worldMatrix;
};

/**
 * Get the world matrices of all instances of this node.
 */
SceneNode.prototype.getInstanceMatrices = (function () {
  var M = mat4.create();

  return function (viewMatrix = null) {
    if (this.instances.length) {
      if (this.instanceMatrices.length !== this.instances.length * 16) {
        this.instanceMatrices = new Float32Array(16 * this.instances.length);
      }

      var instanceMatrices = this.instanceMatrices;

      for (var i = 0, n = this.instances.length; i < n; ++i) {
        var instance = this.instances[i];
        var worldMatrix = instance.getWorldMatrix();

        if (viewMatrix) {
          mat4.multiply(M, viewMatrix, worldMatrix);
          utils.mat4_copyToOffset(instanceMatrices, i * 16, M);
        } else {
          utils.mat4_copyToOffset(instanceMatrices, i * 16, worldMatrix);
        }

      }
    } else {
      if (this.instanceMatrices !== this._instanceMatrices) {
        this.instanceMatrices = this._instanceMatrices;
      }
    }
    return this.instanceMatrices;
  }
})();

/**
 * Test the given node for ancestry.
 */
SceneNode.prototype.hasAncestor = function (node) {
  if (node === null) {
    return false;
  } else {
    return this.parent && (this.parent === node || this.parent.hasAncestor(node));
  }
};

/**
 * Set node parent.
 */
SceneNode.prototype.setParent = function (node) {
  if (this === node || node.hasAncestor(this)) {
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

/**
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

/**
 * Find the one true master.
 */
SceneNode.prototype.getMaster = function () {
  if (this.master) {
    return this.master.getMaster();
  }
  return this;
};

/**
 * Create an instance of this node tree.
 */
SceneNode.prototype.createInstance = function () {
  var node = SceneNode();
<<<<<<< HEAD
  var master = this.getMaster();
=======
  node._id = this._id + ' instance';
  var master = this.getMaster() || this;
>>>>>>> de73ee8... thing

  node._setMaster(master);

  // Create instances of all children and parent them to this node.

  for (var i = 0; i < this.children.length; ++i) {
    var child = this.children[i].createInstance();
    child.setParent(node);
  }

  return node;
};

/**
 * Remove a node and its children from the scene graph.
 */
SceneNode.prototype.remove = function () {
  this._setMaster(null);
  this.setParent(null);

  for (var i = 0, n = this.children.length; i < n; ++i) {
    this.children[i].remove();
  }
};

/**
 * Recursively find the given node and remove it.
 */
SceneNode.prototype.removeNode = function (node) {
  if (!node) {
    return;
  }
  if (!node.hasAncestor(this)) {
    return;
  }

  for (var i = 0, n = this.children.length; i < n; ++i) {
    this.children[i].removeNode(node);
  }
}

/**
 * Add unique object to list.
 */
function addToList(list, obj) {
  var index = list.indexOf(obj);
  if (index < 0) {
    list.push(obj);
  }
}

/**
 * Remove matching object from list.
 */
function removeFromList(list, obj) {
  var index = list.indexOf(obj);
  if (index >= 0) {
    list.splice(index, 1);
  }
}

/**
 * Return the effective local matrix of this node.
 */
SceneNode.prototype._getLocalMatrix = function () {
  if (this.master) {
    return this.master._getLocalMatrix();
  } else {
    return this.localMatrix;
  }
};

/**
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

SceneNode.prototype.dump = function (depth = 0) {
  var str = this._id;

  if (this.master) {
    str += ' instance';
  }

  if (this.children.length) {
    str += ', ' + this.children.length + ' children';
  }

  if (this.instances.length) {
    str += ', ' + this.instances.length + ' instances';
  }

  str = ' '.repeat(depth * 2) + str;

  console.log(str);

  for (var i = 0; i < this.children.length; ++i) {
    this.children[i].dump(depth + 1);
  }
}