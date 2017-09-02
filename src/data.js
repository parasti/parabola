var data = module.exports;

data.fetchBinaryFile = function (path) {
  return new Promise(function (resolve, reject) {
    var req = new window.XMLHttpRequest();
    req.responseType = 'arraybuffer';
    req.onload = function () {
      if (this.status === 200) {
        resolve(this.response);
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
      resolve(this);
    };
    img.src = 'data/' + path;
  });
};

data.fetchSolid = function (path) {
  return data.fetchBinaryFile(path).then(function (buffer) {
    return require('./solid.js').load(buffer);
  });
};

data.loadFile = function (file, onload) {
  return new Promise(function (resolve, reject) {
    var reader = new window.FileReader();
    reader.addEventListener('load', function (e) {
      resolve(this.result);
    });
    reader.readAsArrayBuffer(file);
  });
};
