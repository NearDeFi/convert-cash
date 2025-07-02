use crate::*;

const FT_TRANSFER_GAS: Gas = Gas::from_tgas(20);
const CALLBACK_GAS: Gas = Gas::from_tgas(5);

#[ext_contract(ext_ft)]
trait FungibleToken {
    fn ft_transfer(
        &mut self,
        solver_id: AccountId,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
    );
}

// This trait is for the contract's own callbacks
#[ext_contract(ext_self)]
trait Callbacks {
    fn on_ft_transfer_callback(
        &mut self,
        solver_id: AccountId,
        receiver_id: AccountId,
        amount: U128,
        #[callback_result] call_result: Result<(), PromiseError>,
    ) -> bool;
}

#[near(contract_state)]
#[derive(Default)]
pub struct MyContract {}

#[near]
impl MyContract {
    pub fn ft_transfer_with_callback(
        &mut self,
        solver_id: AccountId,
        ft_contract: AccountId,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
    ) -> Promise {
        ext_ft::ext(ft_contract)
            .with_attached_deposit(1)
            .with_static_gas(FT_TRANSFER_GAS)
            .ft_transfer(receiver_id.clone(), amount, memo)
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(CALLBACK_GAS)
                    .on_ft_transfer_callback(solver_id, receiver_id, amount),
            )
    }

    #[private]
    pub fn on_ft_transfer_callback(
        &mut self,
        solver_id: AccountId,
        receiver_id: AccountId,
        amount: U128,
        #[callback_result] call_result: Result<(), PromiseError>,
    ) -> bool {
        match call_result {
            Ok(()) => {
                env::log_str(&format!(
                    "ft_transfer to {} of amount {} succeeded",
                    receiver_id, amount.0
                ));

                self.update_intent_state(solver_id, State::LiquidityProvided);

                true
            }
            Err(e) => {
                env::log_str(&format!(
                    "ft_transfer to {} of amount {} failed: {:?}",
                    receiver_id, amount.0, e
                ));
                false
            }
        }
    }
}
