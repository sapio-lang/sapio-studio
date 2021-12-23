import { Button, TextField } from '@mui/material';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import React from 'react';
import { useDispatch } from 'react-redux';
import { FormEventHandler } from 'react-transition-group/node_modules/@types/react';
import { close_modal } from '../ModalSlice';

export function SapioCompilerModal(props: { show: boolean }) {
    const dispatch = useDispatch();
    const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const form = event.currentTarget;
        // triggers reconnect
        dispatch(close_modal());
    };
    return (
        <Dialog open={props.show} onClose={() => dispatch(close_modal())}>
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
                <Button onClick={() => dispatch(close_modal())}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}
