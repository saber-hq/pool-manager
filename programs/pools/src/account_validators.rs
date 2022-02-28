//! Validations for various accounts.

use crate::{
    CommitNewAdmin, ImportPoolAsOperator, ImportPoolPermissionless, SendFeesToBeneficiary,
    SetBeneficiary, SetOperator, SwapContext,
};
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;
use stable_swap_client::state::SwapTokenInfo;
use vipers::prelude::*;

impl<'info> Validate<'info> for ImportPoolPermissionless<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(self.swap.admin_key, self.pool);
        assert_keys_eq!(self.swap.pool_mint, self.lp_mint);

        // validate that the fees are going to the expected pool account
        self.validate_fee_accounts(&self.token_a_fees, &self.swap.token_a)?;
        self.validate_fee_accounts(&self.token_b_fees, &self.swap.token_b)?;

        Ok(())
    }
}

impl<'info> ImportPoolPermissionless<'info> {
    pub fn validate_initial_parameters(&self) -> Result<()> {
        let swap = &self.swap;
        let pm = &self.pool_manager;
        invariant!(
            swap.initial_amp_factor >= pm.min_permissionless_amp_factor
                && swap.target_amp_factor <= pm.max_permissionless_amp_factor,
            InitialAmpOutOfRange
        );
        invariant!(swap.fees == pm.initial_fees.into(), InitialFeesMismatch);

        let token_a_mint = swap.token_a.mint;
        let token_b_mint = swap.token_b.mint;
        assert_keys_neq!(token_a_mint, token_b_mint, SwapTokensCannotBeEqual);
        require!(token_a_mint < token_b_mint, SwapTokensNotSorted);

        Ok(())
    }

    fn validate_fee_accounts(
        &self,
        fees: &Account<TokenAccount>,
        swap_token_info: &SwapTokenInfo,
    ) -> Result<()> {
        assert_keys_eq!(fees.owner, self.pool);
        assert_keys_eq!(fees.mint, swap_token_info.mint);
        invariant!(fees.delegate.is_none());
        invariant!(fees.close_authority.is_none());
        assert_keys_eq!(*fees, swap_token_info.admin_fees);
        Ok(())
    }
}

impl<'info> Validate<'info> for ImportPoolAsOperator<'info> {
    fn validate(&self) -> Result<()> {
        invariant!(
            self.admin_or_operator.key() == self.import_pool.pool_manager.admin
                || self.admin_or_operator.key() == self.import_pool.pool_manager.operator,
            NotAdminOrOperator
        );
        Ok(())
    }
}

impl<'info> Validate<'info> for SwapContext<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(self.pool_manager.admin, self.admin, NotAdmin);
        assert_keys_eq!(self.pool_manager, self.pool.manager);

        assert_keys_eq!(self.swap, self.pool.swap);
        Ok(())
    }
}

impl<'info> Validate<'info> for CommitNewAdmin<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(self.pool_manager.admin, self.admin, NotAdmin);
        assert_keys_eq!(self.pool_manager, self.pool.manager);

        assert_keys_eq!(self.swap, self.pool.swap);
        Ok(())
    }
}

impl<'info> Validate<'info> for SendFeesToBeneficiary<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(self.pool_manager, self.pool.manager);
        assert_keys_eq!(
            self.beneficiary_account.owner,
            self.pool_manager.beneficiary
        );
        invariant!(
            self.fee_account.key() == self.pool.token_a_fees
                || self.fee_account.key() == self.pool.token_b_fees,
            InvalidFeeAccount,
        );

        Ok(())
    }
}

impl<'info> Validate<'info> for SetOperator<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(self.pool_manager.admin, self.admin, NotAdmin);
        Ok(())
    }
}

impl<'info> Validate<'info> for SetBeneficiary<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(self.pool_manager.admin, self.admin, NotAdmin);
        Ok(())
    }
}
