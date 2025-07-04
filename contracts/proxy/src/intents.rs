use crate::*;

#[near(serializers = [json, borsh])]
#[derive(Clone, PartialEq)]
pub enum State {
    Deposited,
    Claimed,
    LiquidityProvided,
    SwapComplete,
    UserLiquidityProvided,
    LiquidityReturned,
}

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct Intent {
    pub state: State,
    pub amount: String,
    pub hash: String,
    pub src_token_address: String,
    pub src_chain_id: u64,
    pub dest_token_address: String,
    pub dest_chain_id: u64,
    pub dest_receiver_address: String,
}

#[near]
impl Contract {
    pub fn new_intent(
        &mut self,
        amount: String,
        hash: String,
        src_token_address: String,
        src_chain_id: u64,
        dest_token_address: String,
        dest_chain_id: u64,
        dest_receiver_address: String,
    ) {
        // TODO require intent agent

        let found = self.intents.iter().find(|d| d.hash == hash);
        require!(found.is_none(), "Intent with this hash already exists");

        self.intents.push(Intent {
            state: State::Deposited,
            amount,
            hash,
            src_token_address,
            src_chain_id,
            dest_token_address,
            dest_chain_id,
            dest_receiver_address,
        });
    }

    // debugging remove later
    pub fn clear_intents(&mut self) {
        self.require_owner();

        self.intents.clear();
    }

    pub fn get_intents(&self) -> Vec<&Intent> {
        self.intents.iter().collect()
    }

    pub fn claim_intent(&mut self, index: u32) {
        let solver_id = env::predecessor_account_id();
        // require!(
        //     self.approved_solvers.contains(&solver_id),
        //     "Solver not approved"
        // );

        let intent = self.intents.get(index).expect("Intent not found");

        self.solver_id_to_intent_index.insert(solver_id, index);

        self.intents.replace(
            index,
            Intent {
                state: State::Claimed,
                ..intent.clone()
            },
        );
    }

    pub fn update_intent_state(&mut self, solver_id: AccountId, state: State) {
        let (intent, index) = self.get_intent_and_index(solver_id);

        self.intents.replace(
            index,
            Intent {
                state,
                ..intent.clone()
            },
        );
    }

    pub fn get_intent_by_solver(&self, solver_id: AccountId) -> Intent {
        let (intent, _index) = self.get_intent_and_index(solver_id);
        intent
    }

    // helper

    fn get_intent_and_index(&self, solver_id: AccountId) -> (Intent, u32) {
        let index = self
            .solver_id_to_intent_index
            .get(&solver_id)
            .expect("No intent index found for solver");
        let intent = self.intents.get(*index).unwrap().clone();
        (intent, *index)
    }
}
