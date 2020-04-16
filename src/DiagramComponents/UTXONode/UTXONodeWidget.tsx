import styled from '@emotion/styled';
import { DefaultPortLabel } from '@projectstorm/react-diagrams';
import { DiagramEngine } from '@projectstorm/react-diagrams-core';
import * as _ from 'lodash';
import * as React from 'react';
import './Ants.css';
import { UTXONodeModel } from './UTXONodeModel';
//import { css } from '@emotion/core';


//border: solid 2px ${p => (p.selected ? 'rgb(0,192,255)' : 'white')};
const UTXONode = styled.div<{ background: string; selected: boolean; confirmed: boolean}>`
border-radius: 50%;
padding: 20px;
background-color: ${p => p.background};
font-family: sans-serif;
color: white;
border: 2px solid transparent;
overflow: visible;
font-size: 11px;
box-shadow: ${p => (p.selected ? '4px 4px 2px rgba(0,192,255,0.5)': 'none')};
background: ${p => {
    const ants_color = p.selected ? 'rgba(0,192,255,0.5)': 'transparent';
    return (!p.confirmed? 'linear-gradient('+p.background +','+ p.background+') padding-box, repeating-linear-gradient(-45deg, black 0, black 25%, '+ants_color+' 0, '+ants_color+' 50%) 0 / 1em 1em' : '')
}};
animation: ${p => !p.confirmed? "ants 12s linear infinite" : "none"};
`;

const Title = styled.div`
display: flex;
white-space: nowrap;
justify-items: center;
`;

const TitleName = styled.div`
flex-grow: 1;
padding: 5px 5px;
`;

const Ports = styled.div`
display: flex;
`;

const PortsContainer = styled.div`
flex-grow: 1;
display: flex;
flex-direction: column;

&:first-child {
    margin-right: 10px;
}

&:only-child {
    margin-right: 0px;
}
`;

/**
 * Marching ants border
 */


interface DefaultNodeProps {
	node: UTXONodeModel ;
	engine: DiagramEngine;
}

/**
 * Default node that models the UTXONodeModel. It creates two columns
 * for both all the input ports on the left, and the output ports on the right.
 */
export class UTXONodeWidget extends React.Component<DefaultNodeProps> {
    circle: SVGCircleElement | null;
    callback: () => any;
    mounted: boolean;
    constructor(props:any) {
        super(props);
        this.circle = null;
        this.mounted=false;
        this.callback = () =>
        {
            if (this.circle == null) return;
            let point = this.props.node.getPosition();
			this.circle.setAttribute('cx', point.x.toString());
			this.circle.setAttribute('cy', point.y.toString());
        }
    }
	generatePort = (port :any) => {
		return <DefaultPortLabel engine={this.props.engine} port={port} key={port.id} />;
	};

	componentDidMount() {
		this.mounted = true;
		this.callback();
	}

	componentWillUnmount() {
		this.mounted = false;
	}

	render() {
		return (
			<UTXONode
				data-default-utxonode-name={this.props.node.name}
				selected={this.props.node.isSelected()}
				confirmed={this.props.node.isConfirmed()}
				background={this.props.node.color}>
				<Title>
					<TitleName>UTXO {this.props.node.value/100e6} BTC</TitleName>
				</Title>
				<Ports>
					<PortsContainer>{_.map(this.props.node.getInPorts(), this.generatePort)}</PortsContainer>
					<PortsContainer>{_.map(this.props.node.getOutPorts(), this.generatePort)}</PortsContainer>
				</Ports>
				<Title>
					<TitleName>{this.props.node.name}</TitleName>
				</Title>
			</UTXONode>
		);
	}
}

            /*
            */
