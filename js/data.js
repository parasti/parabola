'use strict';

function fetchBinaryFile(path) {
  return new Promise(function(resolve, reject) {
    var req = new XMLHttpRequest();
    req.responseType = 'arraybuffer';
    req.onload = function() {
      if (this.status === 200) {
        resolve(this.response);
      }
    };
    req.open('GET', 'data/' + path);
    req.send();
  });
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