'use strict';

var createBuffer = require('gl-buffer');
var createVAO = require('gl-vao');
var glslify = require('glslify');
var glm = require('gl-matrix');
var mat4 = glm.mat4;
var vec3 = glm.vec3;

module.exports = function(game, opts) {
  return new OutlinePlugin(game, opts);
};

function OutlinePlugin(game, opts) {
  this.game = game;
  this.shell = game.shell;

  this.mesherPlugin = game.plugins.get('voxel-mesher');
  if (!this.mesherPlugin) throw new Error('voxel-outline requires voxel-mesher');

  this.shaderPlugin = game.plugins.get('voxel-shader');
  if (!this.shaderPlugin) throw new Error('voxel-outline requires voxel-shader');

  this.showOutline = opts.showOutline !== undefined ? opts.showOutline : true;
  this.showThrough = opts.showThrough !== undefined ? opts.showThrough : false;
  this.colorVector = opts.color !== undefined ? opts.color : [1,0,0,1]; // red, RGBA TODO: convert from hex? TODO: same in voxel-chunkborder

  this.haveTarget = false;
  this.modelMatrix = mat4.create();

  this.enable();
}

OutlinePlugin.prototype.enable = function() {
  this.shell.on('gl-init', this.onInit = this.shaderInit.bind(this));
  this.shell.on('gl-render', this.onRender = this.render.bind(this));
  this.game.on('tick', this.onTick = this.tick.bind(this)); // TODO: _.throttle? https://github.com/maxogden/voxel-highlight/blob/master/index.js#L56
};

OutlinePlugin.prototype.disable = function() {
  this.game.removeListener('tick', this.onTick);
  this.shell.removeListener('gl-render', this.onRender = this.render.bind(this));
  this.shell.removeListener('gl-init', this.onInit);
  this.haveTarget = false;
};

var scratch0 = vec3.create();
OutlinePlugin.prototype.tick = function() {
  var hit = this.game.raycastVoxels();

  if (!hit) {
    // remove outline if any
    this.haveTarget = false;
    return;
  }

  this.haveTarget = true;

  // translate to voxel position
  // TODO: only change if voxel target changed?
  mat4.identity(this.modelMatrix);
  scratch0[0] = hit.voxel[2];
  scratch0[1] = hit.voxel[1];
  scratch0[2] = hit.voxel[0];
  mat4.translate(this.modelMatrix, this.modelMatrix, scratch0);
};

OutlinePlugin.prototype.render = function() {
  if (this.showOutline && this.haveTarget) {
    var gl = this.shell.gl;

    if (this.showThrough) gl.disable(gl.DEPTH_TEST);

    this.outlineShader.bind();
    this.outlineShader.attributes.position.location = 0;
    this.outlineShader.uniforms.projection = this.shaderPlugin.projectionMatrix;
    this.outlineShader.uniforms.view = this.shaderPlugin.viewMatrix;
    this.outlineShader.uniforms.color = this.colorVector;
    this.outlineShader.uniforms.model = this.modelMatrix;
    var outlineVAO = this.mesh;
    outlineVAO.bind();
    outlineVAO.draw(gl.LINES, outlineVAO.length);
    outlineVAO.unbind();
  }
};

// TODO: can we use the same simple shaders as elsewhere? (e.g. voxel-chunkborder)
// no need to specialize here
OutlinePlugin.prototype.shaderInit = function() {
  this.outlineShader = glslify({
    inline: true,
    vertex: "/* voxel-outline vertex shader */\
attribute vec3 position;\
uniform mat4 projection;\
uniform mat4 view;\
uniform mat4 model;\
void main() {\
  gl_Position = projection * view * model * vec4(position, 1.0);\
}",

  fragment: "/* voxel-outline fragment shader */\
precision highp float;\
uniform vec4 color;\
void main() {\
  gl_FragColor = color;\
}"})(this.shell.gl);

  // create outline mesh

  // TODO: refactor with voxel-chunkborder, very similar

  var epsilon = 0.001;
  var w = 1 + epsilon;
  var outlineVertexArray = new Uint8Array([
    0,0,0,
    0,0,w,
    0,w,0,
    0,w,w,
    w,0,0,
    w,0,w,
    w,w,0,
    w,w,w
  ]);

  var indexArray = new Uint16Array([
    0,1, 0,2, 2,3, 3,1,
    0,4, 4,5, 5,1,
    5,7, 7,3,
    7,6, 6,2,
    6,4
  ]);

  var outlineVertexCount = indexArray.length;

  var gl = this.shell.gl;

  var outlineBuf = createBuffer(gl, outlineVertexArray);
  var indexBuf = createBuffer(gl, indexArray, gl.ELEMENT_ARRAY_BUFFER);

  var outlineVAO = createVAO(gl, [
      { buffer: outlineBuf,
        type: gl.UNSIGNED_BYTE,
        size: 3
      }], indexBuf);
  outlineVAO.length = outlineVertexCount;

  this.mesh = outlineVAO;
};

