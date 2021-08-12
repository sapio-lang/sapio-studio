import {
    DefaultLinkFactory,
} from '@projectstorm/react-diagrams';
import { SpendLinkSegment } from './SpendLink';
import { SpendLinkModel } from './SpendLinkModel';
import { SpendLinkWidget } from './SpendLinkWidget';
import * as React from 'react';
import {
    GenerateModelEvent,
    GenerateWidgetEvent,
} from '@projectstorm/react-canvas-core';
export class SpendLinkFactory extends DefaultLinkFactory {
    generateModel(event: GenerateModelEvent): SpendLinkModel {
        return new SpendLinkModel();
    }
    constructor() {
        super('spend');
    }
    generateLinkSegment(
        model: SpendLinkModel,
        selected: boolean,
        path: string
    ): JSX.Element {
        return (
            <g>
                {' '}
                <SpendLinkSegment model={model} path={path} />{' '}
            </g>
        );
    }
    generateReactWidget(event: GenerateWidgetEvent<any>): JSX.Element {
        return (
            <SpendLinkWidget
                link={event.model}
                diagramEngine={this.engine}
            ></SpendLinkWidget>
        );
    }
}
