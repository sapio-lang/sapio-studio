import { DefaultLinkModel, DefaultPortModel } from '@projectstorm/react-diagrams';
import * as React from 'react';

export class SpendLinkModel extends DefaultLinkModel {
	constructor() {
		super({
			type: 'spend',
			width: 5
		});
	}
}

export class SpendPortModel extends DefaultPortModel {

	createLinkModel(factory) {
		return new SpendLinkModel();
	}
}
const percentages = Array.from(Array(101).keys()).map(x => x/100.0);
export class SpendLinkSegment extends React.Component {
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
        // TODO: make link appear once, make percent_idx random
		this.percent_idx = 0;
        this.mounted = false;
        this.circle = null;
        this.path = null;
		this.callback = () => {
			if (!this.circle || !this.path) {
				return;
			}


			let point = this.path.getPointAtLength(this.path.getTotalLength() * (percentages[this.percent_idx]));

			this.circle.setAttribute('cx', point.x);
			this.circle.setAttribute('cy', point.y);
			this.percent_idx += 1;
			if (this.percent_idx > 100) {
				this.percent_idx = 0;
			}

			if (this.mounted) {
				requestAnimationFrame(this.callback);
			}
		};
	}

	componentDidMount() {
		this.mounted = true;
		requestAnimationFrame(this.callback);
	}

	componentWillUnmount() {
		this.mounted = false;
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
				<circle
					ref={ref => {
						this.circle = ref;
					}}
					r={10}
					fill="orange"
				/>
			</>
		);
	}
}


