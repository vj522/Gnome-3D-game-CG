import { mat4, vec3 } from '../../lib/glm.js';
import { Transform } from '../core/Transform.js';
import {
    calculateAxisAlignedBoundingBox,
    mergeAxisAlignedBoundingBoxes,
} from '../core/MeshUtils.js';

import { Physics } from '../physics/Physics.js';
import { FloorPhysics } from '../physics/FloorPhysics.js';



export class Scene {

    constructor(game) {

        this.scene = { entities: [] };       //izris
        this.collisions = { entities: [] }; //trki
        this.floor = { entities: [] };     //collisions za tla posebaj

        this.entities = this.scene.entities;
        // Initiate physics bound for this scene
        this.physics = new Physics(game, this.collisions);
        this.floorPhysics = new FloorPhysics();

    }


    addEntity(entity) {
        this.scene.entities.push(entity);
    }
    
    addEntities(entities) {
        this.scene.entities.push(...entities);
    }

    addEntitiesBox(entities) {
        this.collisions.entities.push(...entities);
    }

    addEntitiesFloor(entities) {
        this.floor.entities.push(...entities);

        // Register floor collision mesh for exact collisions
        this.floorPhysics.setFloorCollision(this.floor.entities);
    }
       

    clear() {
        this.entities.length = 0;
        this.collisionEntities.length = 0;
        this.floorEntities.length = 0;
    }

    /* ==============================
       Internal helpers
    ============================== */

    //spremenimo naš gltf file v lašje iterativni za uporabo
    changeToVec(entities) {
        for (const entity of entities){
            for (const primitive of entity.primitives){
                const positions = primitive.mesh.positions;
                primitive.mesh.vertices = []
                for (let i = 0; i < positions.length; i += 3) {
                    const v = vec3.fromValues(
                        positions[i],
                        positions[i + 1],
                        positions[i + 2]
                    );
                    primitive.mesh.vertices.push(v);
                }
            }
        }
    }

    addTransform(entities){
        for (const entity of entities){
            entity.transform = new Transform({
                matrix: mat4.clone(entity.modelMatrix)
            });
        }
    }


    //ustvarimo aabb bounding boxes for collisions
    computeAABBs(){ 
        for (const entity of this.collisions.entities) {
            // console.log(entity)
            const boxes = entity.primitives.map(primitive => calculateAxisAlignedBoundingBox(primitive.mesh));
            entity.aabb = mergeAxisAlignedBoundingBoxes(boxes);
        }
    }

}
