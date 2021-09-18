import { Button, Select } from '@mui/material';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
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
