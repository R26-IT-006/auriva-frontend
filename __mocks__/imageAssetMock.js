// Stands in for a bundled image under the plain-node jest config.
//
// Metro turns `require('.../ant.jpg')` into a React Native asset reference —
// a module id, not a file. Node's require cannot read a .jpg at all, so any
// test that touches constants/wordImages.js dies at import time and the module
// stays untestable. That is how the Progress Report shipped reading image
// fields it was never given: nothing could exercise the map.
//
// The exact value does not matter, only that it is a stable non-null token
// each mapped word resolves to — which is precisely what the resolver
// guarantees and what its tests compare by identity.
module.exports = 'test-image-asset';
