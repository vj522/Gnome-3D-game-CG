// Simple GLM wrapper - re-export from gl-matrix
// This allows us to use the same syntax as glm in C++

import * as glMatrix from 'https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/+esm';

export const mat4 = glMatrix.mat4;
export const mat3 = glMatrix.mat3;
export const vec3 = glMatrix.vec3;
export const vec4 = glMatrix.vec4;
export const vec2 = glMatrix.vec2;
export const quat = glMatrix.quat;
