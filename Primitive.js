//Primitiv je osnovni gradnik modela: en model je lahko sestavljen iz več primitivov, vsak ima svoj mesh in material (npr. avtomobil = karoserija + kolesa)
//Primitive shranjuje podatke, MeshUtils pa z njimi dela, jih spreminja

export class Primitive {

    constructor({
        mesh,
        material,
    } = {}) {
        this.mesh = mesh;
        this.material = material;
    }

}
