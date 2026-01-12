import { mat4 } from '../../lib/glm.js';

//kje je objekt, v katero smer je obrnjen in kako velik je
export class Transform {

    constructor({
        rotation = [0, 0, 0, 1],
        translation = [0, 0, 0],
        scale = [1, 1, 1],
        matrix,
    } = {}) {
        this.rotation = rotation;
        this.translation = translation;
        this.scale = scale;
        this._matrixRaw = null;
        if (matrix) {
            this.matrix = matrix;
        }
    }

    get matrix() {
        // If a raw matrix was provided (e.g. from a GLTF node), return it
        // This preserves negative scales/reflections that would be lost by decomposition/reconstruction
        if (this._matrixRaw) {
            return this._matrixRaw;
        }
        return mat4.fromRotationTranslationScale(mat4.create(), this.rotation, this.translation, this.scale);
    }

    set matrix(matrix) {
        // Store the raw matrix to preserve exact transform (including negative scale)
        this._matrixRaw = mat4.clone(matrix);
        mat4.getRotation(this.rotation, matrix);
        mat4.getTranslation(this.translation, matrix);
        mat4.getScaling(this.scale, matrix);
    }

}
