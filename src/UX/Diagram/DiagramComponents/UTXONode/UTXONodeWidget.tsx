import styled from '@emotion/styled';
import {
    DefaultPortLabel,
    DefaultPortModel,
} from '@projectstorm/react-diagrams';
import { DiagramEngine } from '@projectstorm/react-diagrams-core';
import Color from 'color';
import * as _ from 'lodash';
import * as React from 'react';
import { pretty_amount } from '../../../../util';
import './Ants.css';
import { UTXONodeModel } from './UTXONodeModel';
import { BaseEvent } from '@projectstorm/react-canvas-core';
import { UTXOModel } from '../../../../Data/UTXO';
//import { css } from '@emotion/core';

//border: solid 2px ${p => (p.selected ? 'rgb(0,192,255)' : 'white')};
// border-radius: 50%;
// height: 0;
// width: 150%;
// padding-bottom:150%;
const UTXONode = styled.div<{ selected: boolean; confirmed: boolean }>`
    color: white;
    overflow: hidden;
    font-size: 11px;
    border-radius: 25%;
    box-shadow: ${(p) =>
        p.selected ? '4px 1px 10px rgba(0,192,255,0.5)' : 'none'};
    &.unreachable:after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        width: 100%;
        background: rgba(0, 0, 0, 0.7);
        box-shadow: 0px 0px 25px rgba(0, 0, 0, 0.9);
        border-radius: 25%;
        background-clip: border-box;
    }
`;
//border: 2px solid transparent;
//background: ${p => {
//    const ants_color = p.selected ? 'rgba(0,192,255,0.5)': 'transparent';
//    return (!p.confirmed? 'linear-gradient('+p.background +','+ p.background+') padding-box, repeating-linear-gradient(-45deg, black 0, black 25%, '+ants_color+' 0, '+ants_color+' 50%) 0 / 1em 1em' : '')
//}};
//animation: ${p => !p.confirmed? "ants 12s linear infinite" : "none"};

const Title = styled.div<{ color: string }>`
    background: ${(p) => p.color};
    display: flex;
    width: 100%;
    white-space: nowrap;
    justify-items: center;
    text-align: center;
`;

const TitleName = styled.div`
    flex-grow: 1;
    padding: 5px 5px;
`;

const PortsTop = styled.div<{ color: string }>`
    display: flex;
    background-color: ${(p) => p.color};
    color: white;
`;

const PortsBottom = styled.div<{ color: string }>`
    display: flex;
    background-color: ${(p) => p.color};
    color: black;
`;

interface PortsContainer2Props {
    children: React.ReactNode[];
}
class PortsContainerUTXOTop extends React.Component<PortsContainer2Props> {
    render() {
        return (
            <div className="PortsContainerUTXOTop">{this.props.children}</div>
        );
    }
}
class PortsContainerUTXOBottom extends React.Component<PortsContainer2Props> {
    render() {
        return (
            <div className="PortsContainerUTXOBottom">
                {this.props.children}
            </div>
        );
    }
}

/**
 * Marching ants border
 */

interface DefaultNodeProps {
    node: UTXONodeModel;
    engine: DiagramEngine;
}

interface IState {
    is_reachable: boolean;
    is_confirmed: boolean;
    amount: number;
}
/**
 * Default node that models the UTXONodeModel. It creates two columns
 * for both all the input ports on the left, and the output ports on the right.
 */
export class UTXONodeWidget extends React.Component<DefaultNodeProps, IState> {
    node: HTMLDivElement | null;
    callback: () => any;
    mounted: boolean;
    id: number;
    constructor(props: any) {
        super(props);
        this.node = null;
        this.mounted = false;
        this.id = Math.random();
        this.callback = () => {
            if (this.node === null) return;
        };
        this.state = {
            is_confirmed: this.props.node.isConfirmed(),
            is_reachable: this.props.node.isReachable(),
            amount: this.props.node.getAmount(),
        };
        this.props.node.registerReachableCallback((b: boolean) =>
            this.setState({ is_reachable: b })
        );
        this.props.node.registerConfirmedCallback((b:boolean)=>
        {
            this.setState({is_confirmed:b})
        })
        this.props.node.registerListener({
            sync: (e: BaseEvent) => {
                console.log(this.props.node);
                this.setState({
                    amount: (this.props.node as UTXOModel).getAmount(),
                });
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

    componentDidMount() {
        this.mounted = true;
        this.callback();
    }

    componentWillUnmount() {
        this.mounted = false;
    }

    render() {
        const ports_in = _.map(this.props.node.getInPorts(), this.generatePort);
        const ports_out = _.map(
            this.props.node.getOutPorts(),
            this.generatePort
        );
        let color = Color(this.props.node.getOptions().color)
            .alpha(0.2)
            .toString();
        let white = Color('white').toString();
        let black = Color('black').toString();
        const ports_top =
            ports_in.length === 0 ? null : (
                <PortsTop key="ports" color={'transparent'}>
                    <PortsContainerUTXOTop key="inputs">
                        {ports_in}
                    </PortsContainerUTXOTop>
                </PortsTop>
            );
        const ports_bottom =
            ports_out.length === 0 ? null : (
                <PortsBottom color={white}>
                    <PortsContainerUTXOBottom key="outputs">
                        {ports_out}
                    </PortsContainerUTXOBottom>
                </PortsBottom>
            );

        let yellow = Color('yellow').fade(0.2).toString();
        const is_conf = this.state.is_confirmed ? null : (
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

        const reachable_cl = this.state.is_reachable
            ? 'reachable'
            : 'unreachable';
        return (
            <div>
                {ports_top}
                <div style={{ position: 'relative' }}>
                    <UTXONode
                        ref={(node) => (this.node = node)}
                        data-default-utxonode-name={
                            this.props.node.getOptions().name
                        }
                        key={this.id}
                        selected={this.props.node.isSelected()}
                        confirmed={this.state.is_confirmed}
                        className={reachable_cl}
                    >
                        <Title color={color}>
                            <TitleName>
                                {this.props.node.getOptions().name}
                            </TitleName>
                        </Title>
                        {is_conf}
                        <Title color={color}>
                            <TitleName>
                                {pretty_amount(this.state.amount)}
                            </TitleName>
                        </Title>
                        {ports_bottom}
                    </UTXONode>
                </div>
            </div>
        );
    }
}

/*
 */
