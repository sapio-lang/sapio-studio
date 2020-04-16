import { DefaultLinkFactory, DefaultLinkModel, DefaultPortModel } from '@projectstorm/react-diagrams';
import * as React from 'react';

export class OutputLinkModel extends DefaultLinkModel {
	constructor() {
		super({
			type: 'spend',
			width: 15
		});
	}
}

export class OutputPortModel extends DefaultPortModel {

	createLinkModel(factory) {
		return new OutputLinkModel();
	}
}
const percentages = Array.from(Array(101).keys()).map(x => x/100.0);
export class OutputLinkSegment extends React.Component {
    /*
	path: SVGPathElement | null;
	circle: SVGCircleElement | null;
	callback: () => any;
	percent: number;
	handle: any;
	mounted: boolean;
    */
	constructor(props) {
		super(props);
        this.path = null;
	}

	componentDidMount() {
	}

	componentWillUnmount() {
	}

	render() {
		return (
			<>
				<path
					fill="none"
					ref={ref => {
						this.path = ref;
					}}
					strokeWidth={this.props.model.getOptions().width}
					stroke="rgba(0,0,0,0.5)"
					d={this.props.path}
				/>
			</>
		);
	}
}

export class OutputLinkFactory extends DefaultLinkFactory {
	constructor() {
		super('spend');
	}

	generateModel() {
		return new OutputLinkModel();
	}

	generateLinkSegment(model, selected, path) {
		return (
			<g>
				<OutputLinkSegment model={model} path={path} />
			</g>
		);
	}
}
