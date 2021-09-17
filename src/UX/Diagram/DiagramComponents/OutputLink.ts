import { SpendPortModel } from './SpendLink/SpendLink';
import { SpendLinkModel } from './SpendLink/SpendLinkModel';
import { useTheme } from '@material-ui/core';

export class OutputLinkModel extends SpendLinkModel {
    constructor() {
        super({
            type: 'spend',
            width: 15,
        });
        this.link_type = 'nonexclusive';
    }
}

export class OutputPortModel extends SpendPortModel {
    createLinkModel(factory: any) {
        return new OutputLinkModel();
    }
}