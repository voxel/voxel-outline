'use strict';

var createBuffer = require('gl-buffer');
var createVAO = require('gl-vao');
var createSimpleShader = require('simple-3d-shader');
var mat4 = require('gl-mat4');
var inherits = require('inherits');
var EventEmitter = require('events').EventEmitter;
var throttle = require('lodash.throttle');

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
  this.colorVector = opts.color !== undefined ? opts.color : [1,0,0]; // red, RGB TODO: convert from hex? TODO: same in voxel-chunkborder
  this.frequency = opts.frequency ? opts.frequency : 100; // milliseconds to throttle raycasting

  this.currentTarget = undefined;
  this.modelMatrix = mat4.create();

  this.enable();
}
inherits(OutlinePlugin, EventEmitter);

OutlinePlugin.prototype.enable = function() {
  this.shell.on('gl-init', this.onInit = this.shaderInit.bind(this));
  this.shell.on('gl-render', this.onRender = this.render.bind(this));
  this.game.on('tick', this.onTick = throttle(this.tick.bind(this), this.frequency));
};

OutlinePlugin.prototype.disable = function() {
  this.game.removeListener('tick', this.onTick);
  this.shell.removeListener('gl-render', this.onRender = this.render.bind(this));
  this.shell.removeListener('gl-init', this.onInit);
  this.currentTarget = undefined;
};

// slightly enlarge the outline to avoid z-fighting voxel
var epsilon = 0.001; // greater than voxel-wireframe (0.00001) so it doesn't fight there either
var epsilonVector = [1+epsilon, 1+epsilon, 1+epsilon];

OutlinePlugin.prototype.tick = function() {
  var hit = this.game.raycastVoxels();

  if (!hit) {
    // remove outline if any
    if (this.currentTarget) {
      this.emit('remove', this.currentTarget.slice());
    }

    this.currentTarget = undefined;
    return;
  }

  // if changed voxel target, update matrix and emit event
  if (!this.currentTarget ||
      hit.voxel[0] !== this.currentTarget[0] ||
      hit.voxel[1] !== this.currentTarget[1] ||
      hit.voxel[2] !== this.currentTarget[2]) {

    // translate to voxel position
    mat4.identity(this.modelMatrix);
    mat4.translate(this.modelMatrix, this.modelMatrix, hit.voxel);
    mat4.scale(this.modelMatrix, this.modelMatrix, epsilonVector);

    if (this.currentTarget) {
      this.emit('remove', this.currentTarget.slice());
    }

    this.currentTarget = hit.voxel.slice();
    this.emit('highlight', this.currentTarget.slice(), hit);
  }
};

OutlinePlugin.prototype.render = function() {
  if (this.showOutline && this.currentTarget) {
    var gl = this.shell.gl;

    if (this.showThrough) gl.disable(gl.DEPTH_TEST);

    this.outlineShader.bind();
    this.outlineShader.attributes.position.location = 0;
    this.outlineShader.uniforms.projection = this.shaderPlugin.projectionMatrix;
    this.outlineShader.uniforms.view = this.shaderPlugin.viewMatrix;
    this.outlineShader.uniforms.model = this.modelMatrix;
    this.outlineShader.attributes.color = this.colorVector;
    var outlineVAO = this.mesh;
    outlineVAO.bind();
    outlineVAO.draw(gl.LINES, outlineVAO.length);
    outlineVAO.unbind();
  }
};

OutlinePlugin.prototype.shaderInit = function() {
  this.outlineShader = createSimpleShader(this.shell.gl);

  // create outline mesh

  // TODO: refactor with voxel-chunkborder, very similar

  var w = 1;
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

