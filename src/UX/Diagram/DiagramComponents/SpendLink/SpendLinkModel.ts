import {
    DefaultLinkModel,
    DefaultLinkModelOptions,
} from '@projectstorm/react-diagrams';
import { TransactionModel } from '../../../../Data/Transaction';
export class SpendLinkModel extends DefaultLinkModel {
    link_type: 'exclusive' | 'nonexclusive';
    linked_to: TransactionModel | null;

    constructor(options?: DefaultLinkModelOptions) {
        super({
            type: 'spend',
            width: 15,
            ...options,
        });
        this.link_type = 'exclusive';
        this.linked_to = null;
    }
}
