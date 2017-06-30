'use strict';

function fetchBinaryFile(path, onload) {
  var req = new XMLHttpRequest();
  req.responseType = 'arraybuffer';
  req.addEventListener('load', function(e) {
    if (this.status === 200)
      onload.call(this, e);
  });
  req.open('GET', 'data/' + path);
  req.send();
}

function fetchImage(path, onload) {
  var img = new Image();
  img.onload = function () {
    onload.call(this);
  };
  img.src = 'data/' + path;
}

function loadFile(file, onload) {
  var reader = new FileReader();
  reader.addEventListener('load', function (e) {
    onload.call(this, e);
  });
  reader.readAsArrayBuffer(file);
}

module.exports = {
  fetchBinaryFile,
  fetchImage,
  loadFile
};