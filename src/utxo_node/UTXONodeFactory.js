import * as React from 'react';
import { UTXONodeModel } from './UTXONodeModel';
import { UTXONodeWidget } from './UTXONodeWidget';
import { AbstractReactFactory } from '@projectstorm/react-canvas-core';

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

