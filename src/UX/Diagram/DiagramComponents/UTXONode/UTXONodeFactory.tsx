import { AbstractReactFactory } from '@projectstorm/react-canvas-core';
import { DiagramEngine } from '@projectstorm/react-diagrams-core';
import * as React from 'react';
import { UTXONodeModel } from './UTXONodeModel';
import { UTXONodeWidget } from './UTXONodeWidget';

export class UTXONodeFactory extends AbstractReactFactory<
    UTXONodeModel,
    DiagramEngine
> {
    constructor() {
        super('utxo-node');
    }

    generateModel(event: any) {
        return new UTXONodeModel();
    }

    generateReactWidget(event: any) {
        return <UTXONodeWidget engine={this.engine} node={event.model} />;
    }
}
