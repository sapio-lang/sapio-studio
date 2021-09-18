import { Button, Select } from '@material-ui/core';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import React from 'react';
import { BitcoinNodeManager } from '../../Data/BitcoinNode';

export function ViewContractModal(props: {
    show: boolean;
    hide: () => void;
    bitcoin_node_manager: BitcoinNodeManager;
}) {
    return (
        <Dialog open={props.show} onClose={props.hide}>
            <DialogTitle>View Existing Contract</DialogTitle>
            <DialogContent>
                <form>
                    <Select
                        placeholder="Existing Contract"
                        className=" mr-sm-2"
                    />
                    <Button type="submit">View</Button>
                </form>
            </DialogContent>
            <DialogActions>
                <Button onClick={props.hide}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}
