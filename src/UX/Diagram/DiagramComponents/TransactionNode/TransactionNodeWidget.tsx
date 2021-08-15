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
//import { css } from '@emotion/core';

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
        return <div className="PortsContainerBottom">{this.props.children}</div>;
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
    color: string;
    purpose: string;
}

/**
 * Default node that models the CustomNodeModel. It creates two columns
 * for both all the input ports on the left, and the output ports on the right.
 */
export class TransactionNodeWidget extends React.Component<
    DefaultNodeProps,
    IState
> {
    constructor(props: any) {
        super(props);
        this.state = {
            is_reachable: this.props.node.is_reachable,
            color: this.props.node.color,
            purpose: this.props.node.purpose,
        };
        this.props.node.registerReachable((b: boolean) => {
            return this.setState({ is_reachable: b });
        });
        this.props.node.registerListener({
            colorChanged: (e: BaseEvent) => {
                this.setState({ color: this.props.node.color });
            },
            purposeChanged: (e: BaseEvent) => {
                this.setState({ purpose: this.props.node.purpose });
            },
        });
    }
    generatePort = (port: DefaultPortModel) => {
        return (
            <DefaultPortLabel
                engine={this.props.engine}
                port={port}
                key={port.getID()}
            />
        );
    };

    render() {
        let color = Color(this.state.color).alpha(0.2).toString();
        let white = Color('white').toString();
        let black = Color('black').toString();
        let yellow = Color('yellow').fade(0.2).toString();
        const is_conf = this.props.node.isConfirmed() ? null : (
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
                <PortsTop color={"transparent"} style={{ justifyContent:"center" }}>
                    <PortsContainerTop>
                        {_.map(this.props.node.getInPorts(), this.generatePort)}
                    </PortsContainerTop >
                </PortsTop>
                <Node
                    data-default-node-name={this.props.node.name}
                    selected={this.props.node.isSelected()}
                    confirmed={this.props.node.isConfirmed()}
                    background={this.props.node.color}
                    className={
                        (this.state.is_reachable ? 'reachable' : 'unreachable') + " TransactionNode"
                    }
                >
                    <div>
                        <Title color={color}>
                            <TitleName>Transaction</TitleName>
                            <TitleName>{this.props.node.name}</TitleName>
                        </Title>
                        {is_conf}
                        <Title color={color}>
                            <TitleName>{this.state.purpose}</TitleName>
                        </Title>
                        <PortsBottom color={black}>
                            <PortsContainerBottom>
                                {_.map(
                                    this.props.node.getOutPorts(),
                                    this.generatePort
                                )}
                            </PortsContainerBottom>
                        </PortsBottom>
                    </div>
                </Node>
            </>
        );
    }
}
