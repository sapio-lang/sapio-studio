import { PortModel } from '@projectstorm/react-diagrams-core';
import { TransactionModel } from '../../../Data/Transaction';
import { UTXOModel } from '../../../Data/UTXO';
import { SpendPortModel } from './SpendLink/SpendLink';
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

export class OutputPortModel extends SpendPortModel {
    createLinkModel(factory: any) {
        return new OutputLinkModel();
    }

    create_link(x: OutputPortModel, to: TransactionModel, factory: any) {
        let link = this.createLinkModel(factory);
        // TODO: fix?
        link.setSourcePort(this as unknown as PortModel);
        link.setTargetPort(x as unknown as PortModel);
        link.linked_to = to;
        return link;
    }
}
