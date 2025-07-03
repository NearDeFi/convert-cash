use crate::*;

const USDT_CONTRACT: &str = "usdt.tether-token.near";

#[near]
impl Contract {
    pub fn request_liquidity(&mut self, receiver_id: AccountId, amount: U128) -> Promise {
        let solver_id = env::predecessor_account_id();

        // will work or panic
        let intent = self.get_intent_by_solver(solver_id.clone());

        // they can only request liquidity if they have claimed the intent
        require!(intent.state == State::Claimed, "Intent is not claimed");

        self.internal_ft_transfer_with_callback(
            solver_id,
            USDT_CONTRACT.parse().unwrap(),
            receiver_id,
            amount,
            None,
        )
    }
}
