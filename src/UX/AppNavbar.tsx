import React, { useState } from 'react';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import './AppNavbar.css';
import {
    SaveHexModal,
    LoadHexModal,
    CreateContractModal,
    SapioCompilerModal,
    ViewContractModal,
} from './CreateVaultModal';
export function AppNavbar(props: any): JSX.Element {
    const [modalView, setModalView] = useState(false);

    const [modalSapioCompiler, setModalaSapioCompiler] = useState(false);
    const [modalCreate, setModalCreate] = useState(false);
    const [modalCreateAPIS, setModalCreateAPIs] = useState({});
    window.electron.register("create_contracts", (args: [{
        name: string, api:
        Object, key: string
    }]) => {
        setModalCreateAPIs(args);
        setModalCreate(true);
    });

    const [showSim, setSim] = useState(true);
    const toggleSim = (args: string) => {
        console.log('TOG', showSim, args);
        props.toggle_timing_simulator(showSim);
        setSim(!showSim);
    };
    window.electron.register("simulate", toggleSim);

    const [modalLoadHex, setModalLoadHex] = useState(false);
    window.electron.register("load_hex", setModalLoadHex);

    const [modalSaveHex, setModalSaveHex] = useState(false);
    window.electron.register("save_hex", setModalSaveHex);

    return (
        <div>

            <CreateContractModal
                show={modalCreate}
                hide={() => setModalCreate(false)}
                load_new_model={props.load_new_model}
                compiler={props.compiler}
                dynamic_forms={modalCreateAPIS}
            />
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
                load_new_model={props.load_new_model}
            />

            <SaveHexModal
                show={modalSaveHex}
                hide={() => setModalSaveHex(false)}
                contract={props.contract}
            />
        </div>
    );
}
