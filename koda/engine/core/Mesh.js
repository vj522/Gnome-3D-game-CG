//geometrija objekta, njegove točke

export class Mesh {

    constructor({
        vertices = [],
        indices = [],
    } = {}) {
        this.vertices = vertices;
        this.indices = indices;
    }

}