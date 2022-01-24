use crate::Pool;

use anchor_lang::prelude::*;

pub fn pool_admin_cpi_context<'a, 'b, 'c, 'info>(
    pool: &Account<'info, Pool>,
    swap: AccountInfo<'info>,
    swap_program: AccountInfo<'info>,
) -> CpiContext<'a, 'b, 'c, 'info, stable_swap_anchor::AdminUserContext<'info>> {
    CpiContext::new(swap_program, create_pool_admin_user_context(pool, swap))
}

/// Creates an AdminUserContext with the pool account PDA as the admin.
pub fn create_pool_admin_user_context<'info>(
    pool: &Account<'info, Pool>,
    swap: AccountInfo<'info>,
) -> stable_swap_anchor::AdminUserContext<'info> {
    stable_swap_anchor::AdminUserContext {
        // The swap's admin is the pool account (PDA).
        admin: pool.to_account_info(),
        swap,
    }
}
