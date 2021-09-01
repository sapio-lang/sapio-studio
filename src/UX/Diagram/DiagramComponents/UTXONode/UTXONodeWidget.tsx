import styled from '@emotion/styled';
import {
    DefaultPortLabel,
    DefaultPortModel,
} from '@projectstorm/react-diagrams';
import { DiagramEngine } from '@projectstorm/react-diagrams-core';
import Color from 'color';
import * as _ from 'lodash';
import * as React from 'react';
import { PrettyAmount } from '../../../../util';
import './Ants.css';
import { UTXONodeModel } from './UTXONodeModel';
import { BaseEvent } from '@projectstorm/react-canvas-core';
import { UTXOModel } from '../../../../Data/UTXO';
import { useSelector } from 'react-redux';
import { selectIsUnreachable } from '../../../../SimulationSlice';
const white = Color('white').toString();
const black = Color('black').toString();
const yellow = Color('yellow').fade(0.2).toString();
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
//node: HTMLDivElement | null;
//callback: () => any;
export function UTXONodeWidget(props: DefaultNodeProps) {
    const [id, setID] = React.useState(Math.random());
    const is_reachable = useSelector(selectIsUnreachable)(
        props.node.getOptions().txid
    );
    const [is_confirmed, setConfirmed] = React.useState(
        props.node.isConfirmed()
    );
    const [amount, setAmount] = React.useState(props.node.getAmount());
    React.useEffect(() => {
        props.node.registerConfirmedCallback((b: boolean) => setConfirmed(b));
        const l = props.node.registerListener({
            sync: (e: BaseEvent) =>
                setAmount((props.node as UTXOModel).getAmount()),
        });
        return () => {
            props.node.registerConfirmedCallback((b: boolean) => {});
            props.node.deregisterListener(l);
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
    const ports_in = _.map(props.node.getInPorts(), generatePort);
    const ports_out = _.map(props.node.getOutPorts(), generatePort);
    let color = Color(props.node.getOptions().color).alpha(0.2).toString();
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

    const reachable_cl = is_reachable ? 'reachable' : 'unreachable';
    return (
        <div>
            {ports_top}
            <div style={{ position: 'relative' }}>
                <UTXONode
                    data-default-utxonode-name={props.node.getOptions().name}
                    key={id}
                    selected={props.node.isSelected()}
                    confirmed={is_confirmed}
                    className={reachable_cl}
                >
                    <Title color={color}>
                        <TitleName>{props.node.getOptions().name}</TitleName>
                    </Title>
                    {is_conf}
                    <Title color={color}>
                        <TitleName>{PrettyAmount(amount)}</TitleName>
                    </Title>
                    {ports_bottom}
                </UTXONode>
            </div>
        </div>
    );
}
