use crate::*;

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct Deposit {
    token_address: String,
    amount: String,
}

#[near]
impl Contract {
    pub fn set_deposit(&mut self, evm_address: String, token_address: String, amount: String) {
        self.require_owner();

        self.deposit_by_evm_address.insert(
            evm_address,
            Deposit {
                token_address,
                amount,
            },
        );
    }
    pub fn get_deposit(&self, evm_address: String) -> Deposit {
        self.deposit_by_evm_address
            .get(&evm_address)
            .unwrap()
            .clone()
    }
}
