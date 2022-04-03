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

export function NewNickname(props: { show: boolean; hide: () => void }) {
    const [value, set_value] = React.useState<null | string>(null);
    const [key_value, set_key_value] = React.useState<null | string>(null);
    return (
        <Dialog onClose={props.hide} open={props.show}>
            <DialogTitle>Create a new User</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    The key and nickname for the new person. Keys must be
                    unique.
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
                <TextField
                    onChange={(ev) => set_key_value(ev.currentTarget.value)}
                    value={key_value}
                    autoFocus
                    margin="dense"
                    label="Key Hash"
                    name="keyhash"
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
                        if (value !== null && key_value) {
                            await window.electron.chat.add_user(
                                value,
                                key_value
                            );
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
