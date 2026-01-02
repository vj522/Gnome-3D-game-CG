import { Scene } from "./Scene.js";
import { GLTFLoader } from "../loaders/GLTFLoader.js"
import { ForestScene } from "./ForestScene.js";



export class CaveScene extends Scene {

    constructor(game) {
        super(game);
        this.loader = new GLTFLoader();
        this.name = "Cave";
        this.sceneTrigger = {
            bounds: {   min: [-23, 0, -70],  
                        max: [-17, 50, -64], },
            targetScene: null,
            targetPosition: [3, 28.2, -17.5],
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


        //boxes za drevesa, stene, meje površine
        const gltfDataBox = await this.loader.load('objekti/cave_wall/cave_lil.gltf');
        console.log('GLTF model loaded (forest collisions)');

        this.changeToVec(gltfDataBox.entities);
        this.addTransform(gltfDataBox.entities);
        this.addEntitiesBox(gltfDataBox.entities);
        this.computeAABBs();


        // Load floor collision GLTF (single object with exact collision)
        const gltfDataFloor = await this.loader.load('objekti/cave_floor/floor.gltf');
        console.log('Floor GLTF loaded (floor)');

        this.addEntitiesFloor(gltfDataFloor.entities);

    }


}