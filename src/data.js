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

function _fetchMtrlImage(solMtrl) {
  var imagePath = mtrlImages[solMtrl.f];

  if (imagePath) {
    return data.fetchImage(imagePath);
  } else {
    return Promise.reject(Error('Material image for ' + solMtrl.f + ' is unknown'));
  }
}

data.fetchSolImages = function (sol) {
  var promises = [];

  for (var i = 0, n = sol.mtrls.length; i < n; ++i) {
    var solMtrl = sol.mtrls[i];
    var promise = _fetchMtrlImage(solMtrl).catch(function (reason) {
      console.warn(reason);
    });
    promises.push(promise);
  }

  return Promise.all(promises).then(function (values) {
    // Value order matches original order. We can use that.

    var images = {};

    for (var i = 0, n = sol.mtrls.length; i < n; ++i) {
      var solMtrl = sol.mtrls[i];
      images[solMtrl.f] = values[i];
    }

    sol._images = images;

    return sol;
  });
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