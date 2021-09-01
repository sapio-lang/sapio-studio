import styled from '@emotion/styled';
import {
    DefaultPortLabel,
    DefaultPortModel,
} from '@projectstorm/react-diagrams';
import { DiagramEngine } from '@projectstorm/react-diagrams-core';
import * as _ from 'lodash';
import * as React from 'react';
import './Ants.css';
import { TransactionNodeModel } from './TransactionNodeModel';
import Color from 'color';
import { BaseEvent } from '@projectstorm/react-canvas-core';
import { useSelector } from 'react-redux';
import { selectIsUnreachable } from '../../../../Data/SimulationSlice';
import * as Bitcoin from 'bitcoinjs-lib';
//import { css } from '@emotion/core';

const white = Color('white').toString();
const black = Color('black').toString();
const yellow = Color('yellow').fade(0.2).toString();
//border: solid 2px ${p => (p.selected ? 'rgb(0,192,255)' : 'white')};
export const Node = styled.div<{
    background: string;
    selected: boolean;
    confirmed: boolean;
}>`
    color: white;
    overflow: visible;
    font-size: 11px;
    box-shadow: ${(p) =>
        p.selected ? '4px 1px 10px rgba(0,192,255,0.5)' : 'none'};

    &.unreachable:after {
        content: '';
        z-index: 2;
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        width: 100%;
        background: rgba(0, 0, 0, 0.7);
        box-shadow: 0px 0px 20px rgba(0, 0, 0, 0.9);
        border-radius: 3.5px 17px;
        background-clip: border-box;
    }
`;
// border-radius: 5px 25px;
// background-color: ${p => p.background};
// border: 2px solid transparent;
// background: ${p => {
//     const ants_color = p.selected ? 'rgba(0,192,255,0.5)': 'transparent';
//     return (!p.confirmed? 'linear-gradient('+p.background +','+ p.background+') padding-box, repeating-linear-gradient(-45deg, black 0, black 25%, '+ants_color+' 0, '+ants_color+' 50%) 0 / 1em 1em' : '')
// }};
// animation: ${p => !p.confirmed? "ants 12s linear infinite" : "none"};

export const Title = styled.div<{ color: string }>`
    background: ${(p) => p.color};
    display: flex;
    white-space: nowrap;
    justify-items: center;
`;

export const TitleName = styled.div`
    flex-grow: 1;
    padding: 5px 5px;
`;

export const PortsTop = styled.div<{ color: string }>`
    display: flex;
    background-color: ${(p) => p.color};
    color: black;
`;

export const PortsBottom = styled.div<{ color: string }>`
    display: flex;
    background-color: ${(p) => p.color};
    color: white;
`;
// background-image: linear-gradient(rgba(255,255,255,1), rgba(255, 255, 255,1));

interface PortsContainerProps {
    children: React.ReactNode[];
}
class PortsContainerTop extends React.Component<PortsContainerProps> {
    render() {
        return <div className="PortsContainerTop">{this.props.children}</div>;
    }
}
class PortsContainerBottom extends React.Component<PortsContainerProps> {
    render() {
        return (
            <div className="PortsContainerBottom">{this.props.children}</div>
        );
    }
}

/**
 * Marching ants border
 */

export interface DefaultNodeProps {
    node: TransactionNodeModel;
    engine: DiagramEngine;
}
interface IState {
    is_reachable: boolean;
    is_confirmed: boolean;
    color: string;
    purpose: string;
}

/**
 * Default node that models the CustomNodeModel. It creates two columns
 * for both all the input ports on the left, and the output ports on the right.
 */
export function TransactionNodeWidget(props: DefaultNodeProps) {
    const [is_confirmed, setConfirmed] = React.useState(
        props.node.isConfirmed()
    );
    const [color, setColor] = React.useState(props.node.color);
    const [purpose, setPurpose] = React.useState(props.node.purpose);
    const is_reachable = useSelector(selectIsUnreachable)(
        (props.node.txn as Bitcoin.Transaction).getId()
    );
    React.useEffect(() => {
        props.node.registerConfirmed((b: boolean) => setConfirmed(b));
        const h = props.node.registerListener({
            colorChanged: (e: BaseEvent) => {
                setColor(props.node.color);
            },
            purposeChanged: (e: BaseEvent) => {
                setPurpose(props.node.purpose);
            },
        });
        return () => {
            props.node.deregisterListener(h);
            props.node.registerConfirmed(() => {});
        };
    });
    const generatePort = (port: DefaultPortModel) => {
        return (
            <DefaultPortLabel
                engine={props.engine}
                port={port}
                key={port.getID()}
            />
        );
    };

    let color_render = Color(color).alpha(0.2).toString();
    const is_conf = is_confirmed ? null : (
        <div
            style={{
                background: yellow,
                color: 'black',
                textAlign: 'center',
            }}
        >
            UNCONFIRMED
        </div>
    );
    return (
        <>
            <PortsTop
                color={'transparent'}
                style={{ justifyContent: 'center' }}
            >
                <PortsContainerTop>
                    {_.map(props.node.getInPorts(), generatePort)}
                </PortsContainerTop>
            </PortsTop>
            <Node
                data-default-node-name={props.node.name}
                selected={props.node.isSelected()}
                confirmed={is_confirmed}
                background={props.node.color}
                className={
                    (is_reachable ? 'reachable' : 'unreachable') +
                    ' TransactionNode'
                }
            >
                <div>
                    <Title color={color_render}>
                        <TitleName>Transaction</TitleName>
                        <TitleName>{props.node.name}</TitleName>
                    </Title>
                    {is_conf}
                    <Title color={color_render}>
                        <TitleName>{purpose}</TitleName>
                    </Title>
                    <PortsBottom color={black}>
                        <PortsContainerBottom>
                            {_.map(props.node.getOutPorts(), generatePort)}
                        </PortsContainerBottom>
                    </PortsBottom>
                </div>
            </Node>
        </>
    );
}
