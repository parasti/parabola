'use strict';

module.exports = MeshData;

/**
 * Some people call this geometry.
 *
 * I call it an awkward name. It's basically a vertex array object,
 * but we keep the source vertex data around for easy rebuilding
 * in case of GL context loss.
 */
function MeshData() {
    if (!(this instanceof MeshData)) {
        return new MeshData();
    }

    // Vertex data and store.
    this.verts = null;
    this.vertsVBO = null;

    // Element data and store.
    this.elems = null;
    this.elemsVBO = null;

    // Model-view matrix store. 1 matrix per scene-node instance.
    this.instanceVBO = null;

    // All of the above, but activated with one GL call.
    this.vao = null;
}

MeshData.prototype.createObjects = function (state) {
    var meshData = this;
    var gl = state.gl;
    var attrs = state.vertexAttrs;

    // Create VBOs.

    meshData.vertsVBO = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, meshData.vertsVBO);
    gl.bufferData(gl.ARRAY_BUFFER, meshData.verts, gl.STATIC_DRAW);

    meshData.elemsVBO = gl.createBuffer();

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, meshData.elemsVBO);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, meshData.elems, gl.STATIC_DRAW);

    meshData.instanceVBO = gl.createBuffer();
    /*
     * Matrix data depends on the number of model instances,
     * which is not yet known at this point.
     */

    // Create and set up the VAO.

    meshData.vao = state.createVertexArray();

    state.bindVertexArray(meshData.vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, meshData.vertsVBO);

    gl.vertexAttribPointer(attrs.Position, 3, gl.FLOAT, false, 8 * 4, 0);
    gl.vertexAttribPointer(attrs.Normal, 3, gl.FLOAT, false, 8 * 4, 12);
    gl.vertexAttribPointer(attrs.TexCoord, 2, gl.FLOAT, false, 8 * 4, 24);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, meshData.elemsVBO);

    gl.enableVertexAttribArray(attrs.Position);
    gl.enableVertexAttribArray(attrs.Normal);
    gl.enableVertexAttribArray(attrs.TexCoord);

    // The complex art of passing a 4x4 matrix as a vertex attribute.

    gl.enableVertexAttribArray(attrs.ModelViewMatrix + 0);
    gl.enableVertexAttribArray(attrs.ModelViewMatrix + 1);
    gl.enableVertexAttribArray(attrs.ModelViewMatrix + 2);
    gl.enableVertexAttribArray(attrs.ModelViewMatrix + 3);

    gl.bindBuffer(gl.ARRAY_BUFFER, meshData.instanceVBO);

    gl.vertexAttribPointer(attrs.ModelViewMatrix + 0, 4, gl.FLOAT, false, 16 * 4, 0);
    gl.vertexAttribPointer(attrs.ModelViewMatrix + 1, 4, gl.FLOAT, false, 16 * 4, 16);
    gl.vertexAttribPointer(attrs.ModelViewMatrix + 2, 4, gl.FLOAT, false, 16 * 4, 32);
    gl.vertexAttribPointer(attrs.ModelViewMatrix + 3, 4, gl.FLOAT, false, 16 * 4, 48);

    state.vertexAttribDivisor(attrs.ModelViewMatrix + 0, 1);
    state.vertexAttribDivisor(attrs.ModelViewMatrix + 1, 1);
    state.vertexAttribDivisor(attrs.ModelViewMatrix + 2, 1);
    state.vertexAttribDivisor(attrs.ModelViewMatrix + 3, 1);

    state.bindVertexArray(null);
};

MeshData.prototype.bindVertexArray = function (state) {
    var meshData = this;

    if (meshData.vao) {
        state.bindVertexArray(meshData.vao);
    }
};
