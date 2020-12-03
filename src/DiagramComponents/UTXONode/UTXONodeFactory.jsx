import {
    AbstractReactFactory,
    GenerateWidgetEvent,
} from '@projectstorm/react-canvas-core';
import * as React from 'react';
import { UTXONodeModel } from './UTXONodeModel';
import { UTXONodeWidget } from './UTXONodeWidget';
import { NodeModel, DiagramEngine } from '@projectstorm/react-diagrams';

export class UTXONodeFactory extends AbstractReactFactory {
    constructor() {
        super('utxo-node');
    }

    generateModel(event) {
        return new UTXONodeModel();
    }

    generateReactWidget(event) {
        return <UTXONodeWidget engine={this.engine} node={event.model} />;
    }
}
