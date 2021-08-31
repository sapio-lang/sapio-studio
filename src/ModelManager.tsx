import { DiagramModel, LinkModel } from '@projectstorm/react-diagrams';
import { ContractModel, timing_cache } from './Data/ContractManager';
import { TransactionModel, PhantomTransactionModel } from './Data/Transaction';
import { UTXOModel } from './Data/UTXO';
import { SpendPortModel } from './UX/Diagram/DiagramComponents/SpendLink/SpendLink';

export class ModelManager {
    model: DiagramModel;
    constructor(model: DiagramModel) {
        this.model = model;
    }
    load(contract: ContractModel) {
        this.model.addAll(
            ...contract.txn_models.filter(
                (v) => !(v instanceof PhantomTransactionModel)
            )
        );
        this.model.addAll(...contract.utxo_models);
        const utxo_links: LinkModel[] = contract.utxo_models
            .map((m: UTXOModel) => m.getOutPorts())
            .flat(1)
            .map((p: SpendPortModel) =>
                Object.entries(p.getLinks()).map((v) => v[1])
            )
            .flat(1);
        this.model.addAll(...utxo_links);
        const tx_links: LinkModel[] = contract.txn_models
            .filter((v) => !(v instanceof PhantomTransactionModel))
            .map((m: TransactionModel) => m.getOutPorts())
            .flat(1)
            .map((p: SpendPortModel) =>
                Object.entries(p.getLinks()).map((v) => v[1])
            )
            .flat(1);

        this.model.addAll(...tx_links);
    }
    unload(contract: ContractModel) {
        contract.txn_models.forEach((m) => m.remove_from_model(this.model));
        timing_cache.cache.clear();
    }
}
