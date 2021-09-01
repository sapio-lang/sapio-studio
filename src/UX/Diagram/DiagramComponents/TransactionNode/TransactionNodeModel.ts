import { NodeModel } from '@projectstorm/react-diagrams';
import {
    NodeModelGenerics,
    PortModel,
    PortModelAlignment,
} from '@projectstorm/react-diagrams-core';
import { OutputPortModel } from '../OutputLink';
import { SpendPortModel } from '../SpendLink/SpendLink';
import { Transaction } from 'bitcoinjs-lib';
import { BasePositionModelOptions } from '@projectstorm/react-canvas-core';
import { DefaultPortModel } from '@projectstorm/react-diagrams';

export interface TransactionNodeModelOptions extends BasePositionModelOptions {
    name: string;
    color: string;
    confirmed: boolean;
    is_reachable: boolean;
    reachable_cb: (b: boolean) => void;
    confirmed_cb: (b: boolean) => void;
    txn: Transaction;
    purpose: string;
}
export interface TransactionNodeModelGenerics extends NodeModelGenerics {
    OPTIONS: TransactionNodeModelOptions;
}
/**
 * Example of a custom model using pure javascript
 */
export class TransactionNodeModel extends NodeModel<TransactionNodeModelGenerics> {
    protected portsIn: SpendPortModel[];
    protected portsOut: OutputPortModel[];
    constructor(
        options: any = {},
        name?: string,
        purpose?: string,
        color?: string,
        txn?: Transaction
    ) {
        super({
            type: 'transaction-node',
            name,
            txn,
            color: color || 'red',
            purpose,
            confirmed: false,
            is_reachable: true,
            reachable_cb: (_a: boolean) => null,
            confirmed_cb: (_a: boolean) => null,
            ...options,
        });
        this.portsOut = [];
        this.portsIn = [];
    }

    setColor(color: string) {
        this.options.color = color;
        this.fireEvent({ color: this.options.color }, 'colorChanged');
    }
    setPurpose(purpose: string) {
        this.options.purpose = purpose;
        this.fireEvent({ purpose }, 'purposeChanged');
    }

    setConfirmed(opt: boolean) {
        this.options.confirmed = opt;
        this.options.confirmed_cb(opt);
    }
    registerConfirmed(f: (b: boolean) => void) {
        this.options.confirmed_cb = f;
    }
    isConfirmed(): boolean {
        return this.options.confirmed;
    }
    setReachable(b: boolean) {
        this.options.is_reachable = b;
        this.options.reachable_cb(b);
    }
    registerReachable(f: (b: boolean) => void) {
        this.options.reachable_cb = f;
    }
    isReachable(): boolean {
        return this.options.is_reachable;
    }

    doClone(lookupTable: {}, clone: any) {
        clone.portsIn = [];
        clone.portsOut = [];
        super.doClone(lookupTable, clone);
    }

    removePort(port: SpendPortModel | OutputPortModel) {
        super.removePort(port);
        if (port.getOptions().in) {
            this.portsIn.splice(this.portsIn.indexOf(port));
        } else {
            this.portsOut.splice(this.portsOut.indexOf(port));
        }
    }

    addPort<T extends SpendPortModel | OutputPortModel>(port: T): T {
        super.addPort(port);
        switch (port.constructor) {
            case SpendPortModel:
                if (this.portsIn.indexOf(port) === -1) {
                    this.portsIn.push(port);
                }
                break;
            case OutputPortModel:
                if (this.portsOut.indexOf(port) === -1) {
                    this.portsOut.push(port);
                }
                break;
        }
        return port;
    }
    addInPort(label: string, after: boolean): SpendPortModel {
        after = after || true;
        const p = new SpendPortModel({
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

    addOutPort(label: string, after: boolean): OutputPortModel {
        after = after || true;
        const p = new OutputPortModel({
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
