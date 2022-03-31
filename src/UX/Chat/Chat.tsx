import { Box, Button } from '@mui/material';
import * as React from 'react';
import VisibilityIcon from '@mui/icons-material/Visibility';
import {
    DataGrid,
    GridActionsCellItem,
    GridColumns,
    GridToolbarContainer,
} from '@mui/x-data-grid';
import './Chat.css';
import { Channel } from './Channel';
import { Add } from '@mui/icons-material';
import { NewNickname } from './NewNickname';
import { NewChannel } from './NewChannel';

export function Chat() {
    React.useEffect(() => {
        async function f() {
            await window.electron.chat.init();
        }
        f();
    });
    return (
        <Box className="Chat">
            <Users></Users>
            <Channels></Channels>
        </Box>
    );
}

const UserGrid: GridColumns = [
    {
        field: 'actions-load',
        type: 'actions',
        flex: 0.2,
        getActions: (params) => [
            <GridActionsCellItem
                key="open-folder"
                icon={<VisibilityIcon />}
                label="Open"
                onClick={() => {
                    // todo:
                }}
            />,
        ],
    },
    {
        field: 'nickname',
        headerName: 'NickName',
        minWidth: 100,
        type: 'text',
        flex: 1,
    },
    {
        field: 'key',
        headerName: 'Key Hash',
        minWidth: 100,
        type: 'text',
        flex: 1,
    },
];
function Users() {
    const [users, set_users] = React.useState<
        { nickname: string; key: string }[]
    >([]);
    React.useEffect(() => {
        let cancel: ReturnType<typeof window.setTimeout>;
        async function f() {
            await window.electron.chat.init();
            set_users(await window.electron.chat.list_users());
            cancel = setTimeout(f, 5000);
        }
        cancel = setTimeout(f, 0);
        return () => {
            clearTimeout(cancel);
        };
    }, []);
    const [add_new_user, set_add_new_user] = React.useState(false);
    function CustomToolbar() {
        return (
            <GridToolbarContainer>
                <Button onClick={() => set_add_new_user(true)}>
                    New User<Add></Add>
                </Button>
            </GridToolbarContainer>
        );
    }
    return (
        <div>
            <NewNickname
                show={add_new_user}
                hide={() => set_add_new_user(false)}
            ></NewNickname>

            <DataGrid
                components={{ Toolbar: CustomToolbar }}
                rows={users.map((v) => {
                    return { id: v.key, ...v };
                })}
                columns={UserGrid}
                disableExtendRowFullWidth={false}
                columnBuffer={3}
                pageSize={10}
                rowsPerPageOptions={[5]}
                disableColumnSelector
                disableSelectionOnClick
            />
        </div>
    );
}

function Channels() {
    const [channels, set_channels] = React.useState<{ channel_id: string }[]>(
        []
    );
    React.useEffect(() => {
        let cancel: ReturnType<typeof window.setTimeout>;
        async function f() {
            set_channels(await window.electron.chat.list_channels());
            cancel = setTimeout(f, 5000);
        }
        cancel = setTimeout(f, 0);
        return () => {
            clearTimeout(cancel);
        };
    }, []);
    const [channel, set_channel] = React.useState<string | null>(null);
    const [add_new_channel, set_add_new_channel] =
        React.useState<boolean>(false);
    const ChannelColumns: GridColumns = [
        {
            field: 'actions-load',
            type: 'actions',
            flex: 0.2,
            getActions: (params) => [
                <GridActionsCellItem
                    key="open-folder"
                    icon={<VisibilityIcon />}
                    label="Open"
                    onClick={() => {
                        typeof params.id === 'string' && set_channel(params.id);
                    }}
                />,
            ],
        },
        {
            field: 'channel_id',
            headerName: 'Channel',
            minWidth: 100,
            type: 'text',
            flex: 1,
        },
    ];
    function CustomToolbar() {
        return (
            <GridToolbarContainer>
                <Button onClick={() => set_add_new_channel(true)}>
                    Create New Channel<Add></Add>
                </Button>
            </GridToolbarContainer>
        );
    }
    return (
        <div>
            <NewChannel
                show={add_new_channel}
                hide={() => set_add_new_channel(false)}
            />
            {channel === null && (
                <DataGrid
                    components={{ Toolbar: CustomToolbar }}
                    rows={channels.map((v) => {
                        return { id: v.channel_id, ...v };
                    })}
                    columns={ChannelColumns}
                    disableExtendRowFullWidth={false}
                    columnBuffer={3}
                    pageSize={10}
                    rowsPerPageOptions={[5]}
                    disableColumnSelector
                    disableSelectionOnClick
                />
            )}
            {channel !== null && (
                <Channel
                    channel_id={channel}
                    close={() => {
                        set_channel(null);
                    }}
                ></Channel>
            )}
        </div>
    );
}
