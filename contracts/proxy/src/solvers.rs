use crate::*;

const USDT_CONTRACT: &str = "usdt.tether-token.near";

#[near]
impl Contract {
    pub fn request_liquidity(&mut self, receiver_id: AccountId, amount: U128) -> Promise {
        let solver_id = env::predecessor_account_id();

        let deposit = self
            .deposits_by_solver
            .get(&solver_id)
            .expect("No deposit found for this solver");

        require!(deposit.state == State::Pending, "Deposit is not pending");

        self.ft_transfer_with_callback(USDT_CONTRACT, solver_id, receiver_id, amount, None)
    }
}
