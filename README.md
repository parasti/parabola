# Parabola

Parabola is a WebGL rewrite of the Neverball renderer in plain old Javascript. See the [demo](https://www.sirde.lv/parabola/).

[Neverball](https://neverball.org/) is a tilt-and-roll action game. Check it out.

Parabola is incomplete, but fun to play with.

Parabola uses instanced and vertex array objects to speed up rendering. A scene graph is used to compute modelview matrices. Neverball-style lighting is partially implemented as a vertex shader.

## Missing stuff

* Ball shadow (blob shadow)
* Mirrors (world mirror on XZ plane)
* ...

## Opportunities

Not in any specific order:

* Non-moving level geometry (bodies that are not attached to a path) could be merged into a single static mesh. That might significantly reduce the number of modelview matrices that need to be computed and uploaded.
* Texture atlas support. Wouldn't it be cool if loading a SOL would download just a single additional image instead of N images where N is the number of materials.
* Sorting batches by distance to camera. A moving camera makes this complicated, but it doesn't have to be instant: a limited number of distance vallues could be computed per frame.

## Background

"Parabola" started out as an April Fools joke on the Neverball forum where I "forked" Neverball. The name is a play on the very real [Nuncabola](http://uppgarn.com/nuncabola/), a reimplementation of Neverball in Java.

Perhaps most famously, Parabola was secretly used to create neverball-poop.gif which I also [posted](http://web.archive.org/web/20210811071354/http://neverforum.com/fmpbo/viewtopic.php?id=3130) on the Neverball forum:

![neverball-poop](https://user-images.githubusercontent.com/179160/231000126-a10cda78-f259-4125-818a-e04139f3a94d.gif)

## Usage

```
npm install
npm start
# navigate to URL
```
