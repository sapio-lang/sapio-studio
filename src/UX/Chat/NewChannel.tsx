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

export function NewChannel(props: { show: boolean; hide: () => void }) {
    const [value, set_value] = React.useState<null | string>(null);
    return (
        <Dialog onClose={props.hide} open={props.show}>
            <DialogTitle>Create a new channel</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    The name of the new channel to create...
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
                            window.electron.chat.send({
                                msg: { Data: 'hello' },
                                channel: value,
                                sent_time_ms: Date.now(),
                            });
                            props.hide();
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
