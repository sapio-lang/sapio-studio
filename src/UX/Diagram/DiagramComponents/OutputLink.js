import { SpendPortModel } from './SpendLink/SpendLink';
import { SpendLinkModel } from './SpendLink/SpendLinkModel';

export class OutputLinkModel extends SpendLinkModel {
    constructor() {
        super({
            type: 'spend',
            width: 15,
            color: 'black',
        });
    }
}

export class OutputPortModel extends SpendPortModel {
    createLinkModel(factory) {
        return new OutputLinkModel();
    }
}
