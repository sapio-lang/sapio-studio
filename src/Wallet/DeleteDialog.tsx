import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
} from '@mui/material';
import React from 'react';
import { useSelector } from 'react-redux';
import { selectWorkspace } from './Slice/Reducer';

export function DeleteDialog(props: {
    set_to_delete: () => void;
    to_delete: ['workspace', string] | ['contract', string] | null;
    reload: () => void;
}) {
    const workspace = useSelector(selectWorkspace);
    return (
        <Dialog onClose={props.set_to_delete} open={props.to_delete !== null}>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Confirm deletion of &quot;{props.to_delete}&quot;? File will
                    be in your trash folder.
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button
                    color="warning"
                    onClick={(ev) => {
                        if (props.to_delete) {
                            switch (props.to_delete[0]) {
                                case 'workspace':
                                    window.electron.sapio.workspaces.trash(
                                        props.to_delete[1]
                                    );
                                    break;
                                case 'contract':
                                    window.electron.sapio.compiled_contracts.trash(
                                        workspace,
                                        props.to_delete[1]
                                    );
                                    break;
                            }
                        }
                        props.set_to_delete();
                        props.reload();
                    }}
                >
                    Delete
                </Button>
                <Button onClick={props.set_to_delete}>Cancel</Button>
            </DialogActions>
        </Dialog>
    );
}
