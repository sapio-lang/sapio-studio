import { Box, Button, FilledInput, FormGroup } from '@mui/material';
import * as React from 'react';
import './Channel.css';
import FormControl, { useFormControl } from '@mui/material/FormControl';
import _ from 'lodash';

export function Channel(props: { channel_id: string; close: () => void }) {
    const [messages, set_messages] = React.useState<any[]>([]);
    React.useEffect(() => {
        let cancel: ReturnType<typeof window.setTimeout>;
        let since = 0;
        let all_messages: any[] = [];
        async function f() {
            const last = since;
            /// todo: small concurrency bug here can lead to messages appearing twice
            const m = await window.electron.chat.list_messages_channel(
                props.channel_id,
                last
            );
            if (m.length) {
                since = Math.max(
                    _(m)
                        .map((msg) => msg.received_time)
                        .max(),
                    since
                );
                all_messages = [...all_messages, ...m];
                set_messages(all_messages);
            }
            cancel = setTimeout(f, 1000);
        }
        cancel = setTimeout(f, 0);
        return () => {
            clearTimeout(cancel);
        };
    }, []);
    const msg_area = React.useRef<HTMLElement>(null);
    React.useEffect(() => {
        if (!msg_area.current) return;
        msg_area.current.scrollTop = msg_area.current.scrollHeight;
    }, [messages]);

    return (
        <Box className="ChatBox">
            <Button onClick={props.close}> Back </Button>
            <Box className="MessageArea" ref={msg_area}>
                {messages.map((m, i) => (
                    <div key={i}>
                        {m.nickname}: {m.body}
                    </div>
                ))}
            </Box>

            <div className="Typing">
                <Typing {...props}></Typing>
            </div>
        </Box>
    );
}

function Typing(props: { channel_id: string }) {
    const [typed, set_typed] = React.useState('');
    const { focused } = useFormControl() || {};
    return (
        <Box
            component="form"
            noValidate
            autoComplete="off"
            onSubmit={(ev: React.FormEvent) => {
                ev.preventDefault();
            }}
        >
            <FormControl fullWidth={true}>
                <FormGroup row={true} sx={{ width: '100%' }} className="Typing">
                    <FilledInput
                        sx={{ width: '75%' }}
                        onChange={(ev) => set_typed(ev.currentTarget.value)}
                        value={typed}
                        autoFocus
                        type="text"
                    />
                    <Button
                        type="submit"
                        color="success"
                        onClick={async (ev) => {
                            ev.preventDefault();
                            if (typed !== '') {
                                window.electron.chat.send({
                                    msg: { Data: typed },
                                    channel: props.channel_id,
                                    sent_time_ms: Date.now(),
                                });
                                set_typed('');
                            }
                        }}
                    >
                        Send
                    </Button>
                </FormGroup>
            </FormControl>
        </Box>
    );
}
