import {
    DefaultPortModel,
    DefaultPortModelOptions,
    PortModel,
} from '@projectstorm/react-diagrams';
import * as React from 'react';
import Color from 'color';
import { SpendLinkModel } from './SpendLinkModel';
import { MutableRefObject } from 'react-transition-group/node_modules/@types/react';

export class SpendPortModel extends DefaultPortModel {
    constructor(options: DefaultPortModelOptions) {
        super({
            ...options,
        });
    }
    createLinkModel(factory: any): SpendLinkModel {
        return new SpendLinkModel();
    }
    spend_link(x: PortModel, factory: any) {
        let link = this.createLinkModel(factory);
        // TODO: fix?
        link.setSourcePort((this as unknown) as PortModel);
        link.setTargetPort(x);
        return link;
    }
}
let unique_key = 0;
type PathSettings = {
    circle: MutableRefObject<SVGCircleElement | null>;
    path: MutableRefObject<SVGPathElement | null>;
    text: MutableRefObject<SVGTextElement | null>;
    x: MutableRefObject<number>;
    y: MutableRefObject<number>;
    set_color: MutableRefObject<boolean>;
    color: MutableRefObject<string>;
    white: MutableRefObject<string>;
};
const all_nodes: Map<typeof unique_key, PathSettings> = new Map();
let percent_idx = 0;
const DEFAULT_SECONDS_ANIMATION = 0;
let seconds = DEFAULT_SECONDS_ANIMATION;
let frames_per_second = 60;
let increment = 100 / frames_per_second / seconds;
(() => {
    const preferences = window.electron.get_preferences_sync();
    seconds =
        (preferences.display['animate-flow'] || DEFAULT_SECONDS_ANIMATION) /
        1000.0;
    frames_per_second = 60;
    increment = 100 / frames_per_second / seconds;
    window.electron.preferences_listener((_, p) => {
        seconds =
            (p.display['animate-flow'] || DEFAULT_SECONDS_ANIMATION) / 1000.0;
        frames_per_second = 60;
        increment = 100 / frames_per_second / seconds;
    });
})();

function update_loop() {
    if (seconds === 0) {
        const color = Color('transparent').toString();
        for (const [_, node] of all_nodes) {
            if (!node.circle.current || !node.path) {
                continue;
            }
            if (node.set_color) {
                node.color.current = color;
            }
        }
        requestAnimationFrame(animation_loop);
        setTimeout(update_loop, (3 * 1000) / frames_per_second);
    } else {
        const percentage = percent_idx / 100;
        const fade = 2 * Math.abs(percentage - 0.5);
        const color = Color('orange').fade(fade).toString();
        const white = Color('white').fade(fade).toString();
        for (const [_, node] of all_nodes) {
            if (!node.circle || !node.path) {
                continue;
            }
            const point = node.path.current?.getPointAtLength(
                node.path.current?.getTotalLength() * percentage
            );
            if (point) {
                node.x.current = point.x;
                node.y.current = point.y;
            }
            if (node.set_color) {
                node.color.current = color;
                node.white.current = white;
            }
        }
        requestAnimationFrame(animation_loop);
        percent_idx = (percent_idx + increment) % 101;
        setTimeout(update_loop, 1000 / frames_per_second);
    }
}
update_loop();

function animation_loop() {
    for (const [_, node] of all_nodes) {
        if (!node.circle || !node.path || !node.text) {
            continue;
        }
        node.circle.current?.setAttribute('fill', node.color.current);
        node.circle.current?.setAttribute('cx', node.x.current.toString());
        node.circle.current?.setAttribute('cy', node.y.current.toString());
        node.text.current?.setAttribute('x', node.x.current.toString());
        node.text.current?.setAttribute('y', node.y.current.toString());
        node.text.current?.setAttribute('fill', node.white.current);
    }
}
animation_loop();

export function SpendLinkSegment(props: {
    model: SpendLinkModel;
    path: string;
}) {
    // TODO: make link appear once, make percent_idx random
    let mounted = React.useRef(false);
    let circle = React.useRef(null as null | SVGCircleElement);
    let text = React.useRef(null as null | SVGTextElement);
    let path = React.useRef(null as null | SVGPathElement);
    let x = React.useRef(0);
    let y = React.useRef(0);
    let stroke = props.model.getOptions().color;
    let color = React.useRef('none');
    let white = React.useRef('white');
    let key = unique_key++;
    let set_color = React.useRef(true);
    all_nodes.set(key, { circle, path, text, x, y, color, white, set_color });
    props.model.registerReachableCallback((is_reachable: boolean) => {
        if (is_reachable) {
            set_color.current = true;
            color.current = 'orange';
            path.current?.setAttribute(
                'stroke',
                Color(props.model.getOptions().color).toString()
            );
        } else {
            set_color.current = false;
            color.current = Color('transparent').toString();
            path.current?.setAttribute(
                'stroke',
                Color(props.model.getOptions().color).fade(0.8).toString()
            );
        }
    });

    React.useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
            all_nodes.delete(key);
        };
    });

    return (
        <>
            <path
                fill="none"
                strokeLinecap="square"
                ref={(ref) => {
                    path.current = ref;
                }}
                stroke={props.model.getOptions().color}
                strokeWidth={props.model.getOptions().width}
                d={props.path}
            />{' '}
            <circle
                ref={(ref) => {
                    circle.current = ref;
                }}
                r={7.5}
            ></circle>
            <text
                textAnchor="middle"
                ref={(ref) => {
                    text.current = ref;
                }}
                fontSize="12px"
                alignmentBaseline="middle"
            >
                ₿
            </text>
        </>
    );
}
