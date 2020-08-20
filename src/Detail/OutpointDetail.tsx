import React from 'react';
import ListGroup from 'react-bootstrap/ListGroup';
import Hex from './Hex';
export class OutpointDetail extends React.Component<{
    txid: string;
    n: number;
    onClick: () => void;
}> {
    render() {
        return (<ListGroup variant="flush" className="OutpointDetail">
            <ListGroup.Item variant="dark">
                <h4> Outpoint </h4>
            </ListGroup.Item>
            <ListGroup.Item variant="dark">
                <ListGroup horizontal={'lg'} className="COutPoint">
                    <ListGroup.Item variant="dark">
                        Hash:Index
                </ListGroup.Item>
                    <ListGroup.Item variant="dark">
                        <Hex className="txhex" readOnly value={this.props.txid.toString() + ":" + this.props.n} />
                    </ListGroup.Item>
                    <ListGroup.Item action variant="success" onClick={this.props.onClick}>Go</ListGroup.Item>
                </ListGroup>

            </ListGroup.Item>
        </ListGroup>);
    }
}


export class TXIDDetail extends React.Component<{
    txid: string;
}> {
    render() {
        return (<ListGroup variant="flush">
            <ListGroup.Item variant="dark">
                <h4> TXID <Hex className="txhex" readOnly value={this.props.txid} /> </h4>
            </ListGroup.Item>
        </ListGroup>);
    }
}