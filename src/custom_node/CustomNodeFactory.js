import { AbstractReactFactory } from '@projectstorm/react-canvas-core';
import * as React from 'react';
import { CustomNodeModel } from './CustomNodeModel';
import { CustomNodeWidget } from './CustomNodeWidget';

export class CustomNodeFactory extends AbstractReactFactory {
	constructor() {
		super('custom-node');
	}

	generateModel(event) {
		return new CustomNodeModel();
	}

	generateReactWidget(event) {
		return <CustomNodeWidget engine={this.engine} node={event.model} />;
	}
}

