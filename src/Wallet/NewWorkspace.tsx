import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    TextField,
} from '@mui/material';
import React from 'react';

export function NewWorkspace(props: {
    show: boolean;
    hide: () => void;
    reload: () => void;
}) {
    const [value, set_value] = React.useState<null | string>(null);
    return (
        <Dialog onClose={props.hide} open={props.show}>
            <DialogTitle>Create a new Workspace</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    What should the workspace be called?
                </DialogContentText>
                <TextField
                    onChange={(ev) => set_value(ev.currentTarget.value)}
                    value={value}
                    autoFocus
                    margin="dense"
                    label="Name"
                    name="name"
                    type="text"
                    fullWidth
                    variant="standard"
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={props.hide}>Cancel</Button>
                <Button
                    color="success"
                    onClick={async (ev) => {
                        if (value !== null) {
                            await window.electron.sapio.workspaces.init(value);
                            props.reload();
                        }
                        props.hide();
                    }}
                >
                    Create
                </Button>
            </DialogActions>
        </Dialog>
    );
}
