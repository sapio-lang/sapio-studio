import React, { useState, useEffect } from 'react';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import './AppNavbar.css';
import { SaveHexModal } from './ContractCreator/SaveHexModal';
import { LoadHexModal } from './ContractCreator/LoadHexModal';
import { SapioCompilerModal } from './ContractCreator/SapioCompilerModal';
import { ViewContractModal } from './ContractCreator/ViewContractModal';
import { CreateContractModal } from './ContractCreator/CreateContractModal';
import { JSONSchema7 } from 'json-schema';
export function AppNavbar(props: any): JSX.Element {
    const [modalView, setModalView] = useState(false);

    const [modalSapioCompiler, setModalaSapioCompiler] = useState(false);

    const [showSim, setSim] = useState(true);
    const toggleSim = (args: string) => {
        console.log('TOG', showSim, args);
        props.toggle_timing_simulator(showSim);
        setSim(!showSim);
    };
    useEffect(() => window.electron.register('simulate', toggleSim));

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
