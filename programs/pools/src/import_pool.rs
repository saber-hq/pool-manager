use crate::ImportPoolPermissionless;
use anchor_lang::prelude::*;
use vipers::unwrap_int;
use vipers::Validate;

/// Import pool without validating initial parameters.
pub fn import_pool_unchecked(
    accounts: &mut ImportPoolPermissionless,
    bump: u8,
    permissionless_import: bool,
) -> ProgramResult {
    accounts.validate()?;

    let pool_manager = &mut accounts.pool_manager;
    pool_manager.num_pools = unwrap_int!(pool_manager.num_pools.checked_add(1));

    let pool = &mut accounts.pool;
    pool.manager = accounts.pool_manager.key();
    pool.mint_a = accounts.swap.token_a.mint.key();
    pool.mint_b = accounts.swap.token_b.mint.key();
    pool.bump = bump;

    pool.swap = accounts.swap.key();
    pool.index = unwrap_int!(accounts.pool_manager.num_pools.checked_sub(1));

    pool.token_a_fees = accounts.token_a_fees.key();
    pool.token_b_fees = accounts.token_b_fees.key();

    // Metadata for clients
    pool.lp_mint = accounts.lp_mint.key();
    pool.token_decimals = accounts.lp_mint.decimals;
    pool.permissionless_import = permissionless_import;

    Ok(())
}
