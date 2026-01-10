import { mat4 } from "../../lib/glm.js";
import { Scene } from "./Scene.js";
import { GLTFLoader } from "../loaders/GLTFLoader.js";
import { Transform } from "../core/Transform.js";
import { ImageLoader } from "../loaders/ImageLoader.js";
import { Texture } from "../core/Texture.js";
import { Sampler } from "../core/Sampler.js";
import { Material } from "../core/Material.js";
import { Primitive } from "../core/Primitive.js";


export class ForestScene extends Scene {

    constructor(game) {
        super(game);
        this.loader = new GLTFLoader();
        this.name = "Forest";
        this.imageLoader = new ImageLoader();
        this.sceneTrigger = {
            bounds: {   min: [2, 10, -20],  
                        max: [4.5, 50, -17], },
            targetScene: null,
            targetPosition: [-21,12.2,-67],
            targetYaw: 3.14,
            triggered: false,
            // Jump mechanics
            gravity: -20.0, // Gravity acceleration
            jumpVelocity: 15.0, // Initial jump velocity (increased for higher jumps)
        };

        // Forest fog settings
        this.fog = {
            color: [0.225, 0.235, 0.235],
            density: 0.13
        };
    }

    async load() {

        const loadingDiv = document.getElementById('loading');

        // Load GLTF model
        loadingDiv.textContent = 'Loading forest';
        const gltfData = await this.loader.load('objekti/ForestScene/forest/forest.gltf');
        console.log('GLTF model loaded (forest)');

        this.changeToVec(gltfData.entities);
        this.addTransform(gltfData.entities);
        this.addEntities(gltfData.entities);


        //boxes za drevesa, stene, meje površine
        const gltfDataBox = await this.loader.load('objekti/ForestScene/wall/forest_all_boxes.gltf');
        console.log('GLTF model loaded (forest collisions)');

        this.changeToVec(gltfDataBox.entities);
        this.addTransform(gltfDataBox.entities);
        this.addEntitiesBox(gltfDataBox.entities);
        this.computeAABBs();

        // Load floor collision GLTF (single object with exact collision)
        const gltfDataFloor = await this.loader.load('objekti/ForestScene/forest_fall/floor.gltf');
        console.log('Floor GLTF loaded (floor)');

        this.addEntitiesFloor(gltfDataFloor.entities);

    }

}