import { DefaultLinkFactory } from '@projectstorm/react-diagrams';
import { SpendLinkModel, SpendLinkSegment } from './SpendLink';
import * as React from 'react';
export class SpendLinkFactory extends DefaultLinkFactory {
	constructor() {
		super('spend');
	}
	generateModel() {
		return new SpendLinkModel();
	}
	generateLinkSegment(model, selected, path) {
		return (<g>
			<SpendLinkSegment model={model} path={path} />
		</g>);
	}
}
