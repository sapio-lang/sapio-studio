import {
    DefaultPortModel,
    NodeModel,
    DefaultNodeModelOptions,
    DefaultNodeModelGenerics,
} from '@projectstorm/react-diagrams';
import {
    PortModelAlignment,
    NodeModelGenerics,
    PortModel,
    LinkModel,
} from '@projectstorm/react-diagrams-core';
import { SpendPortModel } from '../SpendLink/SpendLink';
import { SpendLinkModel } from '../SpendLink/SpendLinkModel';
import {
    BasePositionModelOptions,
    BaseModel,
    BaseModelGenerics,
    DeserializeEvent,
} from '@projectstorm/react-canvas-core';
import _ from 'lodash';
import { TransactionModel } from '../../Data/Transaction';

export interface UTXONodeModelOptions extends BasePositionModelOptions {
    name: string;
    color: string;
    amount: number;
    confirmed: boolean;
    reachable: boolean;
    reachable_callback: (b: boolean) => void;
}
export interface UTXONodeModelGenerics extends NodeModelGenerics {
    OPTIONS: UTXONodeModelOptions;
}
/**
 * Example of a custom model using pure javascript
 */
export abstract class UTXONodeModel extends NodeModel<UTXONodeModelGenerics> {
    protected portsIn: DefaultPortModel[];
    protected portsOut: SpendPortModel[];
    constructor(
        options: any = {},
        name?: string,
        color?: string,
        amount?: number,
        confirmed: boolean = false
    ) {
        color = color || 'red';
        super({
            name,
            color,
            amount,
            confirmed: false,
            type: 'utxo-node',
            reachable: true,
            reachable_callback: (b) => null,
            ...options,
        });
        this.portsOut = [];
        this.portsIn = [];
    }
    sync() {
        this.fireEvent({}, 'sync');
    }
    spent_by(
        spender: TransactionModel,
        s_idx: number,
        idx: number
    ): SpendLinkModel {
        return this.addOutPort('tx' + s_idx).spend_link(
            spender.addInPort('in' + idx)
        );
    }
    abstract getAmount(): number;
    setConfirmed(opt: boolean) {
        this.options.confirmed = opt;
        this.setSelected(true);
    }
    isConfirmed(): boolean {
        return this.options.confirmed;
    }

    setReachable(b: boolean) {
        this.options.reachable = b;
        _(this.portsIn).forEach((port: DefaultPortModel) => {
            for (const item of Object.entries(port.getLinks())) {
                if (item[1] instanceof SpendLinkModel) {
                    item[1].setReachable(b);
                }
            }
        });
        this.options.reachable_callback(b);
    }
    isReachable(): boolean {
        return this.options.reachable;
    }
    registerReachableCallback(c: (b: boolean) => void) {
        this.options.reachable_callback = c;
    }

    doClone(lookupTable: {}, clone: any) {
        clone.portsIn = [];
        clone.portsOut = [];
        super.doClone(lookupTable, clone);
    }

    // TODO: Fix Port type?
    removePort(port: any) {
        super.removePort(port);
        if (port.getOptions().in) {
            this.portsIn.splice(this.portsIn.indexOf(port));
        } else {
            this.portsOut.splice(this.portsOut.indexOf(port));
        }
    }

    // TODO: Fix Port type?
    addPort(port: any) {
        super.addPort(port);
        if (port.getOptions().in) {
            if (this.portsIn.indexOf(port) === -1) {
                this.portsIn.push(port);
            }
        } else {
            if (this.portsOut.indexOf(port) === -1) {
                this.portsOut.push(port);
            }
        }
        return port;
    }
    addInPort(label: string, after?: boolean) {
        after = after || true;
        const p = new DefaultPortModel({
            in: true,
            name: label,
            label: label,
            alignment: PortModelAlignment.TOP,
        });
        if (!after) {
            this.portsIn.splice(0, 0, p);
        }
        return this.addPort(p);
    }

    addOutPort(label: string, after?: boolean) {
        after = after || true;
        const p = new SpendPortModel({
            in: false,
            name: label,
            label: label,
            alignment: PortModelAlignment.BOTTOM,
        });
        if (!after) {
            this.portsOut.splice(0, 0, p);
        }
        return this.addPort(p);
    }

    getInPorts(): DefaultPortModel[] {
        return this.portsIn;
    }
    getOutPorts(): SpendPortModel[] {
        return this.portsOut;
    }
}
