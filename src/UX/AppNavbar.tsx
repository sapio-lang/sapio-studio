import React, { useEffect, useState } from 'react';
import './AppNavbar.css';
import { CreateContractModal } from './ContractCreator/CreateContractModal';
import { LoadHexModal } from './ContractCreator/LoadHexModal';
import { SapioCompilerModal } from './ContractCreator/SapioCompilerModal';
import { SaveHexModal } from './ContractCreator/SaveHexModal';
import { ViewContractModal } from './ContractCreator/ViewContractModal';
export function AppNavbar(props: any): JSX.Element {
    const [modalView, setModalView] = useState(false);

    const [modalSapioCompiler, setModalaSapioCompiler] = useState(false);

    useEffect(() =>
        window.electron.register('simulate', (_: string) =>
            props.toggle_timing_simulator()
        )
    );

    const [modalLoadHex, setModalLoadHex] = useState(false);
    useEffect(() => window.electron.register('load_hex', setModalLoadHex));

    const [modalSaveHex, setModalSaveHex] = useState(false);
    useEffect(() => window.electron.register('save_hex', setModalSaveHex));

    return (
        <div>
            <CreateContractModal />
            <ViewContractModal
                show={modalView}
                hide={() => setModalView(false)}
                bitcoin_node_manager={props.bitcoin_node_manager}
            />

            <SapioCompilerModal
                show={modalSapioCompiler}
                hide={() => setModalaSapioCompiler(false)}
                compiler={props.compiler}
            />

            <LoadHexModal
                show={modalLoadHex}
                hide={() => setModalLoadHex(false)}
            />

            <SaveHexModal
                show={modalSaveHex}
                hide={() => setModalSaveHex(false)}
                contract={props.contract}
            />
        </div>
    );
}
