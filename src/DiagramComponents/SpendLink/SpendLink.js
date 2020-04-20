import { DefaultLinkModel, DefaultPortModel } from '@projectstorm/react-diagrams';
import * as React from 'react';
import Color from "color";

export class SpendLinkModel extends DefaultLinkModel {
	constructor(options={}) {
		super({
			type: 'spend',
			width: 15,
			color: "white",
			...options
		});
	}
}

export class SpendPortModel extends DefaultPortModel {

	createLinkModel(factory) {
		return new SpendLinkModel();
	}
}
const all_nodes = new Map();
let unique_key = 0;
let percent_idx = 0;
let seconds = 10;
let frames_per_second = 60;
let increment = 100 / 60 /10;
function update_loop() {
	const percentage = percent_idx/(100);
	const fade = 2*Math.abs(percentage - 0.5);
	const color = Color("orange").fade(fade).toString();
	for (const [k, node] of all_nodes) {
		if (!node.circle || !node.path) {
			continue;
		}
		const point = node.path.getPointAtLength(node.path.getTotalLength() * percentage);
		node.color = color;
		node.x = point.x;
		node.y = point.y;

	}
	percent_idx = (percent_idx + increment) % 101;
	setTimeout(update_loop, 1000 /frames_per_second);
};
update_loop();
function animation_loop() {
	for (const [k, node] of all_nodes) {
		if (!node.circle || !node.path) {
			continue;
		}
		node.circle.setAttribute("fill", node.color);
		node.circle.setAttribute('cx', node.x);
		node.circle.setAttribute('cy', node.y);
	}
	requestAnimationFrame(animation_loop)
};
animation_loop();

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
        this.mounted = false;
        this.circle = null;
		this.path = null;
		this.x = 0;
		this.y = 0;
		this.color = "none";
		this.key = unique_key++;
		all_nodes.set(this.key, this);
	}

	componentDidMount() {
		this.mounted = true;
	}

	componentWillUnmount() {
		this.mounted = false;
		all_nodes.delete(this.key);
	}

	render() {
		const color = this.props.model.getOptions().color;
		return (
			<>
				<path
					fill="none"
					ref={ref => {
						this.path = ref;
					}}
					strokeWidth={this.props.model.getOptions().width}
					stroke={color}
					d={this.props.path}
				/>
				<circle
					ref={ref => {
						this.circle = ref;
					}}
					r={7.5}
					fill="orange"
				/>
			</>
		);
	}
}


