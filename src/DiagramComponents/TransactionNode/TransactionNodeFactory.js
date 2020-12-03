import { AbstractReactFactory } from '@projectstorm/react-canvas-core';
import * as React from 'react';
import { TransactionNodeModel } from './TransactionNodeModel';
import { TransactionNodeWidget } from './TransactionNodeWidget';

export class TransactionNodeFactory extends AbstractReactFactory {
    constructor() {
        super('transaction-node');
    }

    generateModel(event) {
        return new TransactionNodeModel();
    }

    generateReactWidget(event) {
        return (
            <TransactionNodeWidget engine={this.engine} node={event.model} />
        );
    }
}
