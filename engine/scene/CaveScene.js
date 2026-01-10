import { Scene } from "./Scene.js";
import { GLTFLoader } from "../loaders/GLTFLoader.js"


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
            // Jump mechanics
            gravity: -6.0, // Gravity acceleration
            jumpVelocity: 30.0, // Initial jump velocity (increased for higher jumps)
        };

        // Cave fog settings - less fog
        this.fog = {
            color: [0.1, 0.1, 0.1], // Dark fog for cave
            density: 0.000
        };
    }



    async load() {

        const loadingDiv = document.getElementById('loading');

        // Load GLTF model
        loadingDiv.textContent = 'Loading cave model...';
        const gltfData = await this.loader.load('objekti/CaveScene/cave/cave.gltf');
        console.log('GLTF model loaded (cave)');

        this.changeToVec(gltfData.entities);
        this.addTransform(gltfData.entities);
        this.addEntities(gltfData.entities);

        const gltfBackWall = await this.loader.load('objekti/CaveScene/back_wall/back_wall.gltf');
        this.changeToVec(gltfBackWall.entities);
        this.addTransform(gltfBackWall.entities);
        this.addEntities(gltfBackWall.entities);


        //boxes za drevesa, stene, meje površine
        const gltfDataBox = await this.loader.load('objekti/CaveScene/walls/walls.gltf');
        console.log('GLTF model loaded (cave collisions)');

        this.changeToVec(gltfDataBox.entities);
        this.addTransform(gltfDataBox.entities);
        this.addEntitiesBox(gltfDataBox.entities);
        this.computeAABBs();


        // Load floor collision GLTF (single object with exact collision)
        const gltfDataFloor = await this.loader.load('objekti/CaveScene/floor/floor.gltf');
        console.log('Floor GLTF loaded (floor)');

        this.addEntitiesFloor(gltfDataFloor.entities);

    }


}