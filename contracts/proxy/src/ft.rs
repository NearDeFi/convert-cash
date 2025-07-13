use crate::*;

const FT_TRANSFER_GAS: Gas = Gas::from_tgas(20);

#[allow(dead_code)]
#[ext_contract(ext_ft)]
trait FungibleToken {
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>);
}

impl Contract {
    pub fn internal_ft_transfer(
        &mut self,
        ft_contract: AccountId,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
    ) -> Promise {
        ext_ft::ext(ft_contract)
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(FT_TRANSFER_GAS)
            .ft_transfer(receiver_id.clone(), amount, memo)
    }
}
