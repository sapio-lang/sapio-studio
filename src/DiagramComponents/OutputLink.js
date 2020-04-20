import { DefaultLinkFactory, DefaultLinkModel, DefaultPortModel } from '@projectstorm/react-diagrams';
import * as React from 'react';
import { SpendLinkModel, SpendPortModel } from './SpendLink/SpendLink';

export class OutputLinkModel extends SpendLinkModel {
	constructor() {
		super({
			type: 'spend',
			width: 15,
			color: "black"
		});
	}
}

export class OutputPortModel extends SpendPortModel {

	createLinkModel(factory) {
		return new OutputLinkModel();
	}
}