import { Scene } from "./Scene.js";
import { GLTFLoader } from "../loaders/GLTFLoader.js"
import { Transform } from "../core/Transform.js";
import { ForestScene } from "./ForestScene.js";
import { sineEaseInOut } from "../animators/EasingFunctions.js";
import { mat4, vec3 } from "../../lib/glm.js";


export class CaveScene extends Scene {

    constructor(game) {
        super(game);
        this.loader = new GLTFLoader();
        this.name = "Cave";
        this.torchEntities = [];
        this.torchBaseMatrices = [];
        this.torchOffset = [0.55, -0.30, -0.7];
        this.torchScale = 0.3;
        this.torchBobTime = 0;
        this.torchBobSpeed = 0.5; // Hz za bob animacija
        this.torchBobAmount = 0.08; // koliko se premakne gor-dol
        this.torchAnimStrength = 1.0; // fade-out faktor
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

        // Cave fog settings
        this.fog = {
            color: [0.1, 0.1, 0.1], // Dark fog for cave
            density: 0.000
        };
    }



    async load() {

        const loadingDiv = document.getElementById('loading');
        console.log('CaveScene.load() starting...');

        // Počisti stare entitete
        this.clear();
        this.torchEntities = [];
        this.torchBaseMatrices = [];
        this.torchBobTime = 0;

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

        // Load fire torch GLTF
        loadingDiv.textContent = 'Loading torch...';
        const torchData = await this.loader.load('objekti/fire_torch/scene.gltf');
        console.log('Torch GLTF loaded');
        
        if (torchData.entities?.length) {
            this.torchEntities = torchData.entities;
            this.torchBaseMatrices = torchData.entities.map(entity => mat4.clone(entity.modelMatrix ?? mat4.create()));
            
            // Postavi transform in dodaj v sceno
            this.changeToVec(this.torchEntities);
            this.addTransform(this.torchEntities);
            this.addEntities(this.torchEntities);
            console.log(`Fire torch loaded with ${this.torchEntities.length} entities and added to cave scene`);
        } else {
            console.warn('No torch entity found in GLTF');
        }

    }

    updateHeldItems(playerTransform, playerVelocity){
        if (!this.torchEntities.length) return;

        // Preveri ali se premikamo (threshold 0.15 - malo višja za hitrejši stop)
        const speed = vec3.length(playerVelocity || [0, 0, 0]);
        const isMoving = speed > 0.15;

        let xOffset = 0;
        let yOffset = 0;

        if (isMoving) {
            // Samo animiraj bob kadar se premikamo
            this.torchBobTime += 1/60; // predpostavi 60 fps

            const bobPhase = (this.torchBobTime * this.torchBobSpeed) % 1;
            const phase = bobPhase * Math.PI * 2; // 0 do 2*PI
            
            // U-oblika gibanja:
            // X: premika se levo-desno z sine valovanjem
            xOffset = Math.sin(phase) * 0.12;
            
            // -abs(cos(phase)) = dol (negativno) ko je phase 0 ali 2*PI, gor (manj negativno) ko je phase PI
            yOffset = -Math.abs(Math.cos(phase)) * 0.12;
        } else {
            // Ko se ustavimo, takoj na 0 offsets
            xOffset = 0;
            yOffset = 0;
            // Resetiraj animacijo samo če je že počasi
            if (this.torchBobTime > 0) {
                this.torchBobTime = 0;
            }
        }
        
        const bobOffset = [
            this.torchOffset[0] + xOffset,
            this.torchOffset[1] + yOffset,
            this.torchOffset[2]
        ];

        // Postavi baklo v lokalni offset kamere in jo obrni skupaj z igralcem
        const offsetMatrix = mat4.create();
        mat4.translate(offsetMatrix, offsetMatrix, bobOffset);
        mat4.scale(offsetMatrix, offsetMatrix, [this.torchScale, this.torchScale, this.torchScale]);

        // Apply to all torch entities
        for (let i = 0; i < this.torchEntities.length; i++) {
            const entity = this.torchEntities[i];
            const baseMatrix = this.torchBaseMatrices[i];
            // Upoštevaj izvorno orientacijo/scale modela
            const localTorch = mat4.create();
            mat4.mul(localTorch, offsetMatrix, baseMatrix);
            mat4.mul(entity.modelMatrix, playerTransform.matrix, localTorch);
        }
    }
}