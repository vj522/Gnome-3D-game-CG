import { Scene } from "./Scene.js";
import { GLTFLoader } from "../loaders/GLTFLoader.js"
import { ForestScene } from "./ForestScene.js";



export class CaveScene extends Scene {

    constructor(game) {
        super(game);
        this.loader = new GLTFLoader();
        this.sceneTrigger = {
            //change
            bounds: {   min: [-22, 0, -69],  
                        max: [-18, 50, -60], },
            targetScene: null,
            targetPosition: [3.5, 28.2, -18],
            targetYaw: 3.14,
            triggered: false,
        };
    }



    async load() {

        const loadingDiv = document.getElementById('loading');

        // Load GLTF model
        loadingDiv.textContent = 'Loading cave model...';
        const gltfData = await this.loader.load('objekti/jama/cave_texture.gltf');
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


        // Load floor collision GLTF (single object with exact collision)
        const gltfDataFloor = await this.loader.load('objekti/cave_floor/floor.gltf');
        console.log('Floor GLTF loaded (floor)');

        this.addEntitiesFloor(gltfDataFloor.entities);

    }


}