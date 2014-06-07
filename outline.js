'use strict';

var createBuffer = require('gl-buffer');
var createVAO = require('gl-vao');
var glslify = require('glslify');
var glm = require('gl-matrix');
var mat4 = glm.mat4;

module.exports = function(game, opts) {
  return new OutlinePlugin(game, opts);
};

function OutlinePlugin(game, opts) {
  this.shell = game.shell;

  this.mesherPlugin = game.plugins.get('voxel-mesher');
  if (!this.mesherPlugin) throw new Error('voxel-outline requires voxel-mesher');

  this.shaderPlugin = game.plugins.get('voxel-shader');
  if (!this.shaderPlugin) throw new Error('voxel-outline requires voxel-shader');

  this.showOutline = true;
  this.colorVector = opts.color !== undefined ? opts.color : [1,0,0,1]; // red, RGBA TODO: convert from hex? TODO: same in voxel-chunkborder
  this.modelMatrix = mat4.create(); // TODO

  this.enable();
}

OutlinePlugin.prototype.enable = function() {
  this.shell.on('gl-init', this.onInit = this.shaderInit.bind(this));
  this.shell.on('gl-render', this.onRender = this.render.bind(this));
};

OutlinePlugin.prototype.disable = function() {
  this.shell.removeListener('gl-render', this.onRender = this.render.bind(this));
  this.shell.removeListener('gl-init', this.onInit);
};

OutlinePlugin.prototype.render = function() {
  if (this.showOutline) {
    var gl = this.shell.gl;

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
