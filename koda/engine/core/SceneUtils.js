
import { mat4 } from '../../lib/glm.js';

import { Camera } from './Camera.js';
import { Model } from './Model.js';
import { Parent } from './Parent.js';
import { Transform } from './Transform.js';


//ko obrača glavo, skače se posodablja slika, izrisuje se kaj je vidno
//za first person view mamo neki tazga:
/*
// Predpostavimo, da je player entiteta z Camera in Transform komponento
const playerEntity = player;

// Dobimo matrike
const viewMatrix = getGlobalViewMatrix(playerEntity); // pogled skozi oči igralca
const projectionMatrix = getProjectionMatrix(playerEntity); // perspektiva
const modelMatrix = getGlobalModelMatrix(someObjectEntity); // premiki drugih objektov

// Skupna matrika za shader (MVP)
const mvpMatrix = mat4.create();
mat4.multiply(mvpMatrix, projectionMatrix, viewMatrix);
mat4.multiply(mvpMatrix, mvpMatrix, modelMatrix);
*/


export function getLocalModelMatrix(entity) {
    const matrix = mat4.create();
    for (const transform of entity.getComponentsOfType(Transform)) {
        matrix.multiply(transform.matrix);
    }
    return matrix;
}

export function getGlobalModelMatrix(entity) {
    const parent = entity.getComponentOfType(Parent)?.entity;
    if (parent) {
        const parentMatrix = getGlobalModelMatrix(parent);
        const modelMatrix = getLocalModelMatrix(entity);
        return parentMatrix.multiply(modelMatrix);
    } else {
        return getLocalModelMatrix(entity);
    }
}

export function getLocalViewMatrix(entity) {
    return getLocalModelMatrix(entity).invert();
}

export function getGlobalViewMatrix(entity) {
    return getGlobalModelMatrix(entity).invert();
}

export function getProjectionMatrix(entity) {
    return entity.getComponentOfType(Camera)?.projectionMatrix ?? mat4.create();
}
