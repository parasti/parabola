# Parabola

Parabola is a WebGL rewrite of the Neverball renderer in plain old Javascript.

[Neverball](https://neverball.org/) is a tilt-and-roll action game. Check it out.

Parabola is incomplete, but fun to play with.

Parabola uses geometry instancing and vertex array objects to speed up rendering. A scene graph is used to compute modelview matrices. Neverball-style lighting is partially implemented as a vertex shader.

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
