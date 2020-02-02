var Solid = require('./solid.js');
var mtrlImages = require('./mtrl-images.json');

var data = module.exports;

function _fetchBinaryFile(path) {
  return new Promise(function (resolve, reject) {
    var req = new window.XMLHttpRequest();
    req.responseType = 'arraybuffer';
    req.onload = function () {
      if (req.status === 200) {
        resolve(req.response);
      }
    };
    req.open('GET', 'data/' + path);
    req.send();
  });
};

data.fetchImage = function (path) {
  return new Promise(function (resolve, reject) {
    var img = new window.Image();
    img.onload = function () {
      resolve(img);
    };
    img.src = 'data/' + path;
  });
};

data.fetchSol = function (path) {
  return _fetchBinaryFile(path).then(function (buffer) {
    var sol = Solid(buffer);
    sol.id = path;
    return sol;
  });
};

data.fetchImageForMtrl = function (mtrl) {
  var imagePath = mtrlImages[mtrl.name];

  if (imagePath) {
    return data.fetchImage(imagePath);
  } else {
    return Promise.reject(Error('Material image for ' + mtrl.name + ' is unknown'));
  }
}

data.loadFile = function (file) {
  return new Promise(function (resolve, reject) {
    var reader = new window.FileReader();
    reader.onload = function () {
      resolve(reader.result);
    };
    reader.readAsArrayBuffer(file);
  });
};

data.loadSolid = function (file) {
  return data.loadFile(file).then(Solid);
};