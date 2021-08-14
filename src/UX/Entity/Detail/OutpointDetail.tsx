import React from 'react';
import Button from 'react-bootstrap/esm/Button';
import ListGroup from 'react-bootstrap/ListGroup';
import Hex from './Hex';
import "./OutpointDetail.css";
export class OutpointDetail extends React.Component<{
    txid: string;
    n: number;
    onClick: () => void;
}> {
    render() {
        return (
            <div>
                <span>Outpoint:</span>
                <div className="OutpointDetail">
                    <Hex
                        className="txhex"
                        readOnly
                        value={
                            this.props.txid.toString() +
                            ':' +
                            this.props.n
                        }
                    />

                    <Button
                        variant="link"
                        onClick={() => this.props.onClick()}
                    >
                        <span className="glyphicon glyphicon-chevron-right" style={{ color: "green" }}
                            title="Go to the transaction that created this."
                        ></span>
                    </Button>
                </div>
            </div>
        );
    }
}

export class TXIDDetail extends React.Component<{
    txid: string;
}> {
    render() {
        return (
            <div className="TXIDDetail">

                <span>txid:</span>
                <Hex
                    className="txhex"
                    readOnly
                    value={this.props.txid}
                />

            </div>
        );
    }
}
