//vsak primitiv modela ima svojo obliko, material, Model jih združi v en objekt

export class Model {

    constructor({
        primitives = [],
    } = {}) {
        this.primitives = primitives;
    }

}
