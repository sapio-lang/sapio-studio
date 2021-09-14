import {
    AbstractReactFactory,
    GenerateModelEvent,
    GenerateWidgetEvent,
} from '@projectstorm/react-canvas-core';
import { DiagramEngine } from '@projectstorm/react-diagrams-core';
import * as React from 'react';
import { TransactionNodeModel } from './TransactionNodeModel';
import { TransactionNodeWidget } from './TransactionNodeWidget';

export class TransactionNodeFactory extends AbstractReactFactory<
    TransactionNodeModel,
    DiagramEngine
> {
    constructor() {
        super('transaction-node');
    }

    generateModel(event: GenerateModelEvent) {
        return new TransactionNodeModel();
    }

    generateReactWidget(event: GenerateWidgetEvent<any>): JSX.Element {
        console.log(this);
        return (
            <TransactionNodeWidget engine={this.engine} node={event.model} />
        );
    }
}
