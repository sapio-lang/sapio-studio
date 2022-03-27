import { SpendLinkModel } from './SpendLink/SpendLinkModel';

export class OutputLinkModel extends SpendLinkModel {
    constructor() {
        super({
            type: 'spend',
            width: 15,
        });
        this.link_type = 'nonexclusive';
    }
}
