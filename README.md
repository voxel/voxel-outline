# voxel-outline

Show an outline around the player's currently targeted block (voxel.js plugin)

![screenshot](http://i.imgur.com/x6v7Ov1.png "Screenshot")

Load with [voxel-plugins](https://github.com/deathcap/voxel-plugins).
Comparable to [voxel-highlight](https://github.com/maxogden/voxel-highlight)
except requires [voxel-mesher](https://github.com/deathcap/voxel-mesher) and
[voxel-shader](https://github.com/deathcap/voxel-shader), uses gl-modules
instead of three.js, and has less functionality.

## API

Emits events when the raycast voxel target changes (similar to voxel-highlight):

    var outlinePlugin = game.plugins.get('voxel-outline');

    outlinePlugin.on('highlight', function(pos, info) { /* ... */});
    outlinePlugin.on('remove', function(pos) { /* ... */});

For an example of this API usage, see [voxel-voila](https://github.com/deathcap/voxel-voila).

## License

MIT

