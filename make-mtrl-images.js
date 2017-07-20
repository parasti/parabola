/*
 * Make a table of mtrl to image file mappings.
 */

var process = require('process');
var fs = require('fs');
var path = require('path');

if (process.argv.length < 3) {
  console.log("Usage: make-mtrl-images <data> [output.json]");
  process.exit();
}

var dataDir = process.argv[2];

function findImages(dir) {
  var images = [];

  var fileList = fs.readdirSync(dir);
  fileList.forEach(function (file) {
    file = path.join(dir, file);

    var stats = fs.statSync(file);
    if (stats.isDirectory()) {
      // Recurse
      var moreImages = findImages(file);
      if (moreImages.length > 0) {
        images = images.concat(moreImages);
      }
    } else {
      var ext = path.extname(file);
      if (['.jpg', '.png'].includes(ext)) {
        images.push(file);
      }
    }
  });
  return images;
}

var images = findImages(dataDir);
var mtrls = {};

for (var i = 0; i < images.length; ++i) {
  var file = path.relative(dataDir, images[i]);

  var img = file.replace(/\\/g, '/'); // Normalize.
  var mtrl = img.replace(/^textures\//, '').replace(/\.png$|\.jpg$/, ''); // Materialize.

  mtrls[mtrl] = img;
}

if (process.argv.length > 3) {
  fs.writeFileSync(process.argv[3], JSON.stringify(mtrls));
} else {
  console.log(mtrls);
}