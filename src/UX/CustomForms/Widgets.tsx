import { Label } from '@mui/icons-material';
import { Button, Typography } from '@mui/material';
import { JSONSchema7 } from 'json-schema';
import React from 'react';
export function PathOnly(
    props:
        | {
              schema: JSONSchema7;
              name: string;
              formData: string | null;
              value: string | null;
          }
        | any
) {
    const [val, set_val] = React.useState(props.value);
    React.useEffect(() => {
        props.onChange(val);
    }, [val]);
    return (
        <div>
            <Typography>{props.value ?? 'None Selected'}</Typography>
            <Button
                onClick={async () => {
                    const new_val = await window.electron.select_filename();
                    if (new_val) set_val(new_val);
                }}
            >
                {props.name ?? 'Select File'}
            </Button>
        </div>
    );
}

export const custom_fields = {
    'custom::filename': PathOnly,
};
