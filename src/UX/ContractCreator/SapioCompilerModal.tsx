import { Button, TextField } from '@material-ui/core';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import React from 'react';
import { FormEventHandler } from 'react-transition-group/node_modules/@types/react';

export function SapioCompilerModal(props: {
    hide: () => void;
    show: boolean;
    compiler: any;
}) {
    const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const form = event.currentTarget;
        // triggers reconnect
        props.compiler.socket.close();
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
