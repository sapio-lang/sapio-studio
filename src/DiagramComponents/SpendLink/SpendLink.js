import { DefaultPortModel } from '@projectstorm/react-diagrams';
import * as React from 'react';
import Color from 'color';
import { SpendLinkModel } from './SpendLinkModel';

export class SpendPortModel extends DefaultPortModel {
    constructor(options) {
        super({
            ...options,
        });
    }
    createLinkModel(factory) {
        return new SpendLinkModel();
    }
    spend_link(x, factory) {
        let link = this.createLinkModel(factory);
        link.setSourcePort(this);
        link.setTargetPort(x);
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
    const percentage = percent_idx / 100;
    const fade = 2 * Math.abs(percentage - 0.5);
    const color = Color('orange').fade(fade).toString();
    for (const [_, node] of all_nodes) {
        if (!node.circle || !node.path) {
            continue;
        }
        const point = node.path.getPointAtLength(
            node.path.getTotalLength() * percentage
        );
        node.x = point.x;
        node.y = point.y;
        if (node.set_color) {
            node.color = color;
        }
    }
    requestAnimationFrame(animation_loop);
    percent_idx = (percent_idx + increment) % 101;
    setTimeout(update_loop, 1000 / frames_per_second);
}
update_loop();
function animation_loop() {
    for (const [_, node] of all_nodes) {
        if (!node.circle || !node.path) {
            continue;
        }
        node.circle.setAttribute('fill', node.color);
        node.circle.setAttribute('cx', node.x);
        node.circle.setAttribute('cy', node.y);
    }
}
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
        this.stroke = this.props.model.getOptions().color;
        this.color = 'none';
        this.key = unique_key++;
        all_nodes.set(this.key, this);
        this.set_color = true;
        this.props.model.registerReachableCallback((is_reachable) => {
            if (is_reachable) {
                this.set_color = true;
                this.color = 'orange';
                this.path.setAttribute(
                    'stroke',
                    Color(this.props.model.getOptions().color).toString()
                );
            } else {
                this.set_color = false;
                this.color = Color('transparent').toString();
                this.path.setAttribute(
                    'stroke',
                    Color(this.props.model.getOptions().color)
                        .fade(0.8)
                        .toString()
                );
            }
        });
    }

    componentDidMount() {
        this.mounted = true;
    }

    componentWillUnmount() {
        this.mounted = false;
        all_nodes.delete(this.key);
    }

    render() {
        return (
            <>
                <path
                    fill="none"
                    ref={(ref) => {
                        this.path = ref;
                    }}
                    stroke={this.props.model.getOptions().color}
                    strokeWidth={this.props.model.getOptions().width}
                    d={this.props.path}
                />
                <circle
                    ref={(ref) => {
                        this.circle = ref;
                    }}
                    r={7.5}
                />
            </>
        );
    }
}
