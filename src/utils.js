'use strict';

/**
 * Copy the values starting at index from an array to a mat4
 * @param {mat4} out the receiving matrix
 * @param {array} a the source array
 * @param {number} i index of first value in the source array
 * @returns {mat4} out
 */
exports.mat4_copyFromOffset = function (out, a, i) {
    out[0] = a[i + 0];
    out[1] = a[i + 1];
    out[2] = a[i + 2];
    out[3] = a[i + 3];
    out[4] = a[i + 4];
    out[5] = a[i + 5];
    out[6] = a[i + 6];
    out[7] = a[i + 7];
    out[8] = a[i + 8];
    out[9] = a[i + 9];
    out[10] = a[i + 10];
    out[11] = a[i + 11];
    out[12] = a[i + 12];
    out[13] = a[i + 13];
    out[14] = a[i + 14];
    out[15] = a[i + 15];
    return out;
};

/**
 * Copy the values from a mat4 to an array starting at index.
 * @param {array} out the receiving array
 * @param {number} i index of first value in the receiving array
 * @param {mat4} a the source matrix
 * @returns {array} out
 */
exports.mat4_copyToOffset = function (out, i, a) {
    out[i + 0] = a[0];
    out[i + 1] = a[1];
    out[i + 2] = a[2];
    out[i + 3] = a[3];
    out[i + 4] = a[4];
    out[i + 5] = a[5];
    out[i + 6] = a[6];
    out[i + 7] = a[7];
    out[i + 8] = a[8];
    out[i + 9] = a[9];
    out[i + 10] = a[10];
    out[i + 11] = a[11];
    out[i + 12] = a[12];
    out[i + 13] = a[13];
    out[i + 14] = a[14];
    out[i + 15] = a[15];
    return out;
};