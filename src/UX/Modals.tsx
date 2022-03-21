import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { BitcoinNodeManager } from '../Data/BitcoinNode';
import { ContractModel } from '../Data/ContractManager';
import { LoadHexModal } from './ContractCreator/LoadHexModal';
import { SapioCompilerModal } from './ContractCreator/SapioCompilerModal';
import { SaveHexModal } from './ContractCreator/SaveHexModal';
import { ViewContractModal } from './ContractCreator/ViewContractModal';
import { selectModal } from './ModalSlice';

export function Modals(props: {
    contract: ContractModel;
    bitcoin_node_manager: BitcoinNodeManager;
}) {
    const dispatch = useDispatch();
    const which = useSelector(selectModal);
    return (
        <div>
            <ViewContractModal
                show={which === 'ViewContract'}
                bitcoin_node_manager={props.bitcoin_node_manager}
            />

            <SapioCompilerModal
                show={which === 'SapioServer'}
            ></SapioCompilerModal>

            <LoadHexModal show={which === 'LoadHex'} />

            <SaveHexModal
                show={which === 'SaveHex'}
                contract={props.contract}
            />
        </div>
    );
}
