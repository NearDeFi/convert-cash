use crate::*;

#[allow(dead_code)]
#[ext_contract(ext_self)]
trait Callbacks {
    fn request_liquidity_callback(
        &mut self,
        solver_id: AccountId,
        receiver_id: AccountId,
        amount: U128,
        #[callback_result] call_result: Result<(), PromiseError>,
    ) -> bool;

    fn complete_swap_callback(
        &mut self,
        solver_id: AccountId,
        path: String,
        payload: String,
        key_type: String,
        #[callback_result] call_result: Result<(), PromiseError>,
    ) -> bool;
}

const CALLBACK_GAS: Gas = Gas::from_tgas(5);

const BITFINEX_DEPOSIT_MEMO: &str = "Bitfinex deposit";
const USDT_CONTRACT: &str = "usdt.tether-token.near";

#[near]
impl Contract {
    pub fn request_liquidity(&mut self, receiver_id: AccountId, amount: U128) -> Promise {
        let solver_id = env::predecessor_account_id();

        // they can only request liquidity if they have claimed the intent
        let intent = self.get_intent_by_solver(solver_id.clone());
        require!(intent.state == State::Claimed, "Intent is not claimed");

        self.internal_ft_transfer(
            USDT_CONTRACT.parse().unwrap(),
            receiver_id.clone(),
            amount,
            Some(BITFINEX_DEPOSIT_MEMO.to_owned()),
        )
        .then(
            ext_self::ext(env::current_account_id())
                .with_static_gas(CALLBACK_GAS)
                .request_liquidity_callback(solver_id, receiver_id, amount),
        )
    }

    #[private]
    pub fn request_liquidity_callback(
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

    pub fn complete_swap(&mut self, payload: String) -> Promise {
        let solver_id = env::predecessor_account_id();

        // they can only complete the swap and request a chain sig if they have had the liquidity provided
        let intent = self.get_intent_by_solver(solver_id.clone());
        require!(
            intent.state == State::LiquidityProvided,
            "Intent has not had LiquidityProvided"
        );

        let path = "tron".to_owned();
        let key_type = "Ecdsa".to_owned();

        chainsig::internal_request_signature(path.clone(), payload.clone(), key_type.clone()).then(
            ext_self::ext(env::current_account_id())
                .with_static_gas(CALLBACK_GAS)
                .complete_swap_callback(solver_id, path, payload, key_type),
        )
    }

    #[private]
    pub fn complete_swap_callback(
        &mut self,
        solver_id: AccountId,
        path: String,
        payload: String,
        key_type: String,
        #[callback_result] call_result: Result<(), PromiseError>,
    ) -> bool {
        match call_result {
            Ok(()) => {
                env::log_str(&format!(
                    "signature of path {}, payload {}, key_type {} succeeded",
                    path, payload, key_type
                ));

                self.update_intent_state(solver_id, State::SwapComplete);

                true
            }
            Err(e) => {
                env::log_str(&format!(
                    "signature of path {}, payload {}, key_type {} failed",
                    path, payload, key_type
                ));
                false
            }
        }
    }
}
