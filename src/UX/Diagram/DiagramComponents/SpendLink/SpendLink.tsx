import {
    DefaultPortModel,
    DefaultPortModelOptions,
    PortModel,
} from '@projectstorm/react-diagrams';
import * as React from 'react';
import Color from 'color';
import { SpendLinkModel } from './SpendLinkModel';
import { MutableRefObject } from 'react-transition-group/node_modules/@types/react';
import { useTheme } from '@mui/material';
import { store } from '../../../../Store/store';
import { selectAnimateFlow } from '../../../../Settings/SettingsSlice';
import { TransactionModel } from '../../../../Data/Transaction';
import { UTXOModel } from '../../../../Data/UTXO';
import { useSelector } from 'react-redux';
import { selectIsReachable } from '../../../../Data/SimulationSlice';
import { UTXONodeModel } from '../UTXONode/UTXONodeModel';

export class SpendPortModel extends DefaultPortModel {
    constructor(options: DefaultPortModelOptions) {
        super({
            ...options,
        });
    }
    createLinkModel(factory: any): SpendLinkModel {
        return new SpendLinkModel();
    }
    spend_link(x: SpendPortModel, to: TransactionModel, factory: any) {
        const link = this.createLinkModel(factory);
        // TODO: fix?
        link.setSourcePort(this as unknown as PortModel);
        link.setTargetPort(x as unknown as PortModel);
        link.linked_to = to;
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
    show: MutableRefObject<boolean>;
    color: MutableRefObject<string>;
    white: MutableRefObject<string>;
};
const all_nodes: Map<typeof unique_key, PathSettings> = new Map();

const transparent = Color('transparent').toString();
function update_loop(percent_idx: number) {
    const seconds = selectAnimateFlow(store.getState()) / 1000.0;
    const frames_per_second = 60;
    const increment = 100 / frames_per_second / seconds;
    if (seconds < 0.001) {
        for (const [_, node] of all_nodes) {
            if (!node.circle.current || !node.path) {
                continue;
            }
            if (node.show) {
                node.color.current = transparent;
                node.white.current = transparent;
            }
        }
        requestAnimationFrame(animation_loop);
        setTimeout(
            () => update_loop(percent_idx),
            (3 * 1000) / frames_per_second
        );
    } else {
        const percentage = percent_idx / 100;
        const fade = 2 * Math.abs(percentage - 0.5);
        const color = Color('orange').fade(fade).toString();
        const white = Color('white').fade(fade).toString();
        for (const [_id, node] of all_nodes) {
            if (!node.path.current) {
                continue;
            }
            const point = node.path.current.getPointAtLength(
                node.path.current.getTotalLength() * percentage || 0
            );
            if (point) {
                node.x.current = point.x;
                node.y.current = point.y;
            }
            if (node.show.current) {
                node.color.current = color;
                node.white.current = white;
            } else {
                node.color.current = transparent;
                node.white.current = transparent;
            }
        }
        requestAnimationFrame(animation_loop);
        percent_idx = (percent_idx + increment) % 101;
        setTimeout(() => update_loop(percent_idx), 1000 / frames_per_second);
    }
}

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

let is_running = false;
export function SpendLinkSegment(props: {
    model: SpendLinkModel;
    path: string;
}) {
    const check_is_reachable = useSelector(selectIsReachable);
    React.useEffect(() => {
        if (!is_running) {
            is_running = true;
            update_loop(0);
        }
    });
    // TODO: make link appear once, make percent_idx random
    const mounted = React.useRef(false);
    const circle = React.useRef(null as null | SVGCircleElement);
    const text = React.useRef(null as null | SVGTextElement);
    const path = React.useRef(null as null | SVGPathElement);
    const x = React.useRef(0);
    const y = React.useRef(0);
    const theme = useTheme();
    const stroke =
        props.model.link_type === 'exclusive'
            ? theme.palette.secondary.light
            : theme.palette.primary.light;
    const color = React.useRef('none');
    const white = React.useRef('white');
    const key = unique_key++;
    const show = React.useRef(true);
    all_nodes.set(key, { circle, path, text, x, y, color, white, show });
    const faded_stroke = Color(stroke).fade(0.8).toString();
    React.useEffect(() => {
        const child = props.model.linked_to;
        let reachable = false;
        if (child) {
            switch (child.constructor) {
                case TransactionModel:
                    reachable = check_is_reachable(
                        (child as TransactionModel).get_txid()
                    );
                    break;
            }
        }

        show.current = reachable;
        path.current?.setAttribute('stroke', reachable ? stroke : faded_stroke);
    }, [check_is_reachable]);

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
                stroke={stroke}
                strokeWidth={props.model.getOptions().width}
                d={props.path}
            />
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
