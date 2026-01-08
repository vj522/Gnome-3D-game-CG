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

        // Default fog settings
        this.fog = {
            color: [0.7, 0.8, 0.9],
            density: 0.005
        };

    }

     initTargetScene(targetScene){
        this.sceneTrigger.targetScene = targetScene;
    }

    
    checkTriggers(playerPos) {

        const { min, max } = this.sceneTrigger.bounds;

        // //to get the coordinates for boxes, later outt!!
        // console.log(playerPos)
        console.log(playerPos);
        
        const inBounds =
            playerPos[0] >= min[0] && playerPos[0] <= max[0] &&
            playerPos[1] >= min[1] && playerPos[1] <= max[1] &&
            playerPos[2] >= min[2] && playerPos[2] <= max[2];


        if (inBounds && !this.sceneTrigger.triggered) {
            this.sceneTrigger.triggered = true; // mark as fired, se prestavimo v target sceno
            console.log("in bound, trigger triggered");
            return this.sceneTrigger;

        } else if (!inBounds && this.sceneTrigger.triggered) {
            console.log("out of the trigger area")
            this.sceneTrigger.triggered = false; // reset when leaving, dont enter endless limbo
        }
        
        return null;
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
