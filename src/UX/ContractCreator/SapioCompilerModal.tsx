import { Button, TextField } from '@mui/material';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import React from 'react';
import { FormEventHandler } from 'react-transition-group/node_modules/@types/react';

export function SapioCompilerModal(props: { hide: () => void; show: boolean }) {
    const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const form = event.currentTarget;
        // triggers reconnect
        props.hide();
    };
    return (
        <Dialog open={props.show} onClose={props.hide}>
            <DialogTitle>Set Contract Generator URL</DialogTitle>
            <DialogContent>
                <form onSubmit={handleSubmit}>
                    <TextField
                        name="ws"
                        type="text"
                        placeholder="url"
                        label="Websocket"
                    />
                    <Button type="submit">Set</Button>
                </form>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => props.hide()}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}
