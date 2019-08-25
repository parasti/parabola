var Solid = require('neverball-solid');

var crc32 = require('crc/lib/crc32');

var data = module.exports;

data.fetchBinaryFile = function (path) {
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

data.fetchSolid = function (path) {
  return data.fetchBinaryFile(path).then(function (buffer) {
    var sol = SolidWithCrc(buffer);
    sol.id = path;
    return sol;
  });
};

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
  return data.loadFile(file).then(SolidWithCrc);
};

function SolidWithCrc (buffer) {
  var sol = Solid(buffer);
  sol.crc = crc32(buffer);
  return sol;
}
