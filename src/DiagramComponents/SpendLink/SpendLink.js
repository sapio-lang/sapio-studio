import { DefaultPortModel } from '@projectstorm/react-diagrams';
import * as React from 'react';
import Color from "color";
import { SpendLinkModel } from './SpendLinkModel';

export class SpendPortModel extends DefaultPortModel {
	constructor(options) {
		super({
			...options
		});
	}
	createLinkModel(factory) {
		return new SpendLinkModel();
	}
	spend_link(x, factory) {
		let link = this.createLinkModel(factory);
		link.setSourcePort(this);
		link.setTargetPort(x)
		return link;
	}
}
const all_nodes = new Map();
let unique_key = 0;
let percent_idx = 0;
let seconds = 0.5;
let frames_per_second = 60;
let increment = 100 / frames_per_second / seconds;
function update_loop() {
	const percentage = percent_idx/(100);
	const fade = 2*Math.abs(percentage - 0.5);
	const color = Color("orange").fade(fade).toString();
	for (const [k, node] of all_nodes) {
		if (!node.circle || !node.path) {
			continue;
		}
		const point = node.path.getPointAtLength(node.path.getTotalLength() * percentage);
		node.x = point.x;
		node.y = point.y;
		if (node.is_reachable) {
			node.color = color;
			node.path_width = node.props.model.getOptions().width;
		} else {
			node.color = Color("transparent").toString();
			node.path_width = node.props.model.getOptions().width/10;
		}

	}
	requestAnimationFrame(animation_loop)
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
		node.path.setAttribute('strokeWidth', node.path_width);
	}
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
		this.path_width = this.props.model.getOptions().width;
		this.color = "none";
		this.key = unique_key++;
		all_nodes.set(this.key, this);
		this.is_reachable = true;
		this.props.model.registerReachableCallback((b) => this.is_reachable = b);
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
					fill={"color"}
				/>
			</>
		);
	}
}

