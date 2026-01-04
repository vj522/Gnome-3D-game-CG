import { mat4 } from "../../lib/glm.js";
import { Scene } from "./Scene.js";
import { GLTFLoader } from "../loaders/GLTFLoader.js";
import { Transform } from "../core/Transform.js";
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

                // Oblaki iz seznama pozicij
                const cloudData = await this.loader.load('objekti/cloud1/cloud1.gltf');
                this.changeToVec(cloudData.entities);
                this.addTransform(cloudData.entities);

                // Osnovna matrika brez translacije, da pozicije res določimo sami
                const baseMatrix = mat4.clone(cloudData.entities[0].modelMatrix);
                baseMatrix[12] = 0; // x translation
                baseMatrix[13] = 0; // y translation
                baseMatrix[14] = 0; // z translation

                const positions = [
                    [14, 25, 22],
                    [6, 25, 32],
                    [-4, 25, 30],
                    [30, 22, 30],
                    [0, 22, 35],
                    [0, 22, -35],
                    [-35, 22, 0],
                    [35, 22, 0],
                ];
                // Rotacije za vsak oblak (radiani, okoli Y); po potrebi prilagodi
                const rotationsY = [
                    0,
                    Math.PI * 0.55,
                    Math.PI * 0.28,
                    Math.PI * 0.28,
                    Math.PI * 0.75,
                    Math.PI * 0.95,
                    Math.PI * 1.15,
                    Math.PI * 1.35,
                ];
                const scale = 4;

                const clouds = positions.map((pos, i) => {
                    const m = mat4.create();
                    mat4.translate(m, m, pos);
                    const ry = rotationsY[i % rotationsY.length] || 0;
                    mat4.rotateY(m, m, ry);
                    mat4.scale(m, m, [scale, scale, scale]);
                    mat4.multiply(m, m, baseMatrix);

                    return {
                        ...cloudData.entities[0],
                        modelMatrix: m,
                        transform: new Transform({ matrix: m }),
                    };
                });

                this.addEntities(clouds);

    }


}