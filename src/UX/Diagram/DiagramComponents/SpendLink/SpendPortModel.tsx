import {
    DefaultPortModel,
    DefaultPortModelOptions,
    PortModel,
} from '@projectstorm/react-diagrams';
import { SpendLinkModel } from './SpendLinkModel';
import { TransactionModel } from '../../../../Data/Transaction';

export class SpendPortModel extends DefaultPortModel {
    constructor(options: DefaultPortModelOptions) {
        super({
            ...options,
        });
    }
    createLinkModel(factory: any): SpendLinkModel {
        return new SpendLinkModel();
    }
    spend_link(x: SpendPortModel, to: TransactionModel, factory: any) {
        const link = this.createLinkModel(factory);
        // TODO: fix?
        link.setSourcePort(this as unknown as PortModel);
        link.setTargetPort(x as unknown as PortModel);
        link.linked_to = to;
        return link;
    }
}
