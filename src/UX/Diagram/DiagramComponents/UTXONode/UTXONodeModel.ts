import { DefaultPortModel, NodeModel } from '@projectstorm/react-diagrams';
import {
    PortModelAlignment,
    NodeModelGenerics,
    PortModel,
} from '@projectstorm/react-diagrams-core';
import { SpendPortModel } from '../SpendLink/SpendLink';
import { SpendLinkModel } from '../SpendLink/SpendLinkModel';
import { BasePositionModelOptions } from '@projectstorm/react-canvas-core';
import _ from 'lodash';
import { TransactionModel } from '../../../../Data/Transaction';
import { TXID } from '../../../../util';
import { OutputPortModel } from '../OutputLink';
import { TransactionState } from '../TransactionNode/TransactionNodeModel';
import { ContractModel } from '../../../../Data/ContractManager';

export interface UTXONodeModelOptions extends BasePositionModelOptions {
    name: string;
    color: string;
    amount: number;
    confirmed: TransactionState;
    txid: TXID;
    index: number;
}
export interface UTXONodeModelGenerics extends NodeModelGenerics {
    OPTIONS: UTXONodeModelOptions;
}
/**
 * Example of a custom model using pure javascript
 */
export class UTXONodeModel extends NodeModel<UTXONodeModelGenerics> {
    protected portsIn: OutputPortModel[];
    protected portsOut: SpendPortModel[];
    constructor(
        options: any = {},
        txid?: TXID,
        index?: number,
        name?: string,
        color?: string,
        amount?: number,
        confirmed: TransactionState = 'NotBroadcastable'
    ) {
        color = color || 'red';
        super({
            name,
            txid,
            index,
            color,
            amount,
            confirmed,
            type: 'utxo-node',
            ...options,
        });
        this.portsOut = [];
        this.portsIn = [];
    }
    sync() {
        this.fireEvent({}, 'sync');
    }
    getAmount(): number {
        return this.getOptions().amount;
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
    addPort(port: PortModel): PortModel {
        super.addPort(port);
        switch (port.constructor) {
            case OutputPortModel:
                if (
                    this.portsIn.indexOf(port as unknown as OutputPortModel) ===
                    -1
                ) {
                    this.portsIn.push(port as unknown as OutputPortModel);
                }
                break;
            case SpendPortModel:
                if (
                    this.portsOut.indexOf(port as unknown as SpendPortModel) ===
                    -1
                ) {
                    this.portsOut.push(port as unknown as SpendPortModel);
                }
                break;
            default:
                throw 'Unexpected Port Type';
        }
        return port;
    }
    addInPort(label: string, after?: boolean) {
        after = after || true;
        const p = new OutputPortModel({
            in: true,
            name: label,
            label: '',
            alignment: PortModelAlignment.TOP,
        });
        if (!after) {
            this.portsIn.splice(0, 0, p);
        }
        this.addPort(p as unknown as PortModel);
        return p;
    }

    addOutPort(label: string, after?: boolean): SpendPortModel {
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
        this.addPort(p as unknown as PortModel);
        return p;
    }

    getInPorts(): DefaultPortModel[] {
        return this.portsIn;
    }
    getOutPorts(): SpendPortModel[] {
        return this.portsOut;
    }
}
