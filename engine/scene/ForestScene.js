import { Scene } from "./Scene.js";
import { GLTFLoader } from "../loaders/GLTFLoader.js"
import { CaveScene } from "./CaveScene.js";



export class ForestScene extends Scene {

    constructor(game) {
        super(game);
        this.loader = new GLTFLoader();
        this.sceneTrigger = {
            bounds: {   min: [2, 10, -20],  
                        max: [4, 50, -17], },
            targetScene: null,
            targetPosition: [-18,12.2,-67],
            targetYaw: 3.14,
            triggered: false,
        };

        // Forest fog settings
        this.fog = {
            color: [1.0, 1.0, 1.0],  // Bolj bela megla (prej: 0.8, 0.8, 0.9)
            density: 0.03
        };
    }

    async load() {

        const loadingDiv = document.getElementById('loading');

        // Load GLTF model
        loadingDiv.textContent = 'Loading forest model...';
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
        const gltfDataFloor = await this.loader.load('objekti/ForestScene/floor/floor.gltf');
        console.log('Floor GLTF loaded (floor)');

        this.addEntitiesFloor(gltfDataFloor.entities);

    }


}