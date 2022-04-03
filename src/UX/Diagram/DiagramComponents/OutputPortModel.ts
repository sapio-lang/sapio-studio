import { PortModel } from '@projectstorm/react-diagrams-core';
import { TransactionModel } from '../../../Data/Transaction';
import { SpendPortModel } from './SpendLink/SpendPortModel';
import { OutputLinkModel } from './OutputLink';

export class OutputPortModel extends SpendPortModel {
    createLinkModel(factory: any): OutputLinkModel {
        return new OutputLinkModel();
    }

    create_link(x: OutputPortModel, to: TransactionModel, factory: any) {
        const link = this.createLinkModel(factory);
        // TODO: fix?
        link.setSourcePort(this as unknown as PortModel);
        link.setTargetPort(x as unknown as PortModel);
        link.linked_to = to;
        return link;
    }
}
