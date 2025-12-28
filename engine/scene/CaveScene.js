import { Scene } from "./Scene.js";
import { GLTFLoader } from "../loaders/GLTFLoader.js"
import { ForestScene } from "./ForestScene.js";



export class CaveScene extends Scene {

    constructor(game) {
        super(game);
        this.loader = new GLTFLoader();
        this.sceneTrigger = {
            //diffrent coordinates še poglej!!!
            bounds: {   min: [3.021825211729329, 27.88363407877016, -18.413587828218382],  
                        max: [4.363912958239902, 28.098045344874027, -19.252116849106617], },
            targetScene: ForestScene, 
            triggered: false,
        };
    }

    checkTriggers(playerPos) {
        for (const trigger of this.sceneTrigger) {
            const { min, max } = trigger.bounds;
            const inBounds =
                playerPos[0] >= min[0] && playerPos[0] <= max[0] &&
                playerPos[2] >= min[1] && playerPos[2] <= max[1];

            if (inBounds && !trigger.triggered) {
                trigger.triggered = true; // mark as fired, se prestavimo v target sceno
                return trigger.targetScene;

            } else if (!inBounds) {
                trigger.triggered = false; // reset when leaving, dont enter endless limbo
            }
        }
        return null;
    }


    static async load() {

        // Load GLTF model
        //loadingDiv.textContent = 'Loading forest model...';
        const gltfData = await this.loader.load('objekti/realistic_cave/cave.gltf');
        console.log('GLTF model loaded (cave)');

        this.changeToVec(gltfData.entities);
        this.addTransform(gltfData.entities);
        this.addEntities(gltfData.entities);


        // //boxes za drevesa, stene, meje površine
        // const gltfDataBox = await this.loader.load('objekti/wall/forest_all_boxes.gltf');
        // console.log('GLTF model loaded (forest collisions)');

        // this.changeToVec(gltfDataBox.entities);
        // this.addTransform(gltfDataBox.entities);
        // this.addEntitiesBox(gltfDataBox.entities);
        // this.computeAABBs();

        // // Load floor collision GLTF (single object with exact collision)
        // const gltfDataFloor = await this.loader.load('objekti/floor/floor.gltf');
        // console.log('Floor GLTF loaded (floor)');

        // this.addEntitiesFloor(gltfDataFloor.entities);

    }


}