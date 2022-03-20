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

export type TransactionState =
    | 'Confirmed'
    | 'InMempool'
    | 'NotBroadcastable'
    | 'Broadcastable'
    | 'Unknown'
    | 'Impossible';
export interface TransactionNodeModelOptions extends BasePositionModelOptions {
    name: string;
    color: string;
    confirmed: TransactionState;
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

    doClone(lookupTable: {}, clone: any) {
        clone.portsIn = [];
        clone.portsOut = [];
        super.doClone(lookupTable, clone);
    }

    removePort(port: PortModel) {
        super.removePort(port);
        switch (port.constructor) {
            case SpendPortModel:
                this.portsIn.splice(
                    this.portsIn.indexOf(port as unknown as SpendPortModel)
                );
                break;
            case OutputPortModel:
                this.portsOut.splice(
                    this.portsOut.indexOf(port as unknown as OutputPortModel)
                );
                break;
            default:
                throw 'Wrong Port Type';
        }
    }

    addPort(port: PortModel): PortModel {
        super.addPort(port);
        switch (port.constructor) {
            case SpendPortModel:
                if (
                    this.portsIn.indexOf(port as unknown as SpendPortModel) ===
                    -1
                ) {
                    this.portsIn.push(port as unknown as SpendPortModel);
                }
                break;
            case OutputPortModel:
                if (
                    this.portsOut.indexOf(
                        port as unknown as OutputPortModel
                    ) === -1
                ) {
                    this.portsOut.push(port as unknown as OutputPortModel);
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
        return this.addPort(
            p as unknown as PortModel
        ) as unknown as SpendPortModel;
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
        return this.addPort(
            p as unknown as PortModel
        ) as unknown as OutputPortModel;
    }

    getInPorts(): DefaultPortModel[] {
        return this.portsIn;
    }
    getOutPorts(): SpendPortModel[] {
        return this.portsOut;
    }
}
