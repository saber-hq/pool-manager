//! Manages Saber liquidity pools.
//!
//! # Description
//!
//! The Saber [pools] program allows the DAO to collect fees across all Saber pools
//! and allows anyone to create new StableSwap pools indexed by Saber without permission.
//!
//! # Addresses
//!
//! - **Pools:** [SMANK4F5osjfVpKFH5LPzE6HPpbzSPu5iHPBhuor5xU](https://anchor.so/programs/SMANK4F5osjfVpKFH5LPzE6HPpbzSPu5iHPBhuor5xU)
//!
//! # License
//!
//! The Saber Pools program is licensed under the Affero General Public License, version 3.
#![deny(rustdoc::all)]
#![allow(rustdoc::missing_doc_code_examples)]
#![deny(clippy::unwrap_used)]

mod macros;

use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use stable_swap_anchor::{StableSwap, SwapInfo};
use vipers::Validate;

mod account_validators;
mod cpi_helpers;
mod import_pool;
mod state;

pub use state::*;

declare_id!("SMANK4F5osjfVpKFH5LPzE6HPpbzSPu5iHPBhuor5xU");

/// [pools] program.
#[program]
pub mod pools {
    use anchor_spl::token;

    use super::*;

    /// Creates a new [PoolManager].
    pub fn new_pool_manager(ctx: Context<NewPoolManager>, bump: u8) -> ProgramResult {
        let pool_manager = &mut ctx.accounts.pool_manager;
        pool_manager.base = ctx.accounts.base.key();
        pool_manager.bump = bump;
        pool_manager.num_pools = 0;

        pool_manager.admin = ctx.accounts.admin.key();
        pool_manager.pending_admin = Pubkey::default();

        pool_manager.initial_fees = SwapFees {
            trade_fee_numerator: 4,
            withdraw_fee_numerator: 0,
            admin_trade_fee_numerator: 0,
            admin_withdraw_fee_numerator: 0,

            trade_fee_denominator: 10_000,
            withdraw_fee_denominator: 10_000,
            admin_trade_fee_denominator: 10_000,
            admin_withdraw_fee_denominator: 10_000,
        };

        pool_manager.min_permissionless_amp_factor = 10;
        pool_manager.max_permissionless_amp_factor = 200;

        pool_manager.operator = ctx.accounts.operator.key();
        pool_manager.beneficiary = ctx.accounts.beneficiary.key();

        Ok(())
    }

    /// Imports a [Pool] from a [SwapInfo].
    /// The [SwapInfo] must:
    /// - have the fees accounts set to ATAs of the [Pool]
    /// - have the admin set to the [Pool]
    #[access_control(ctx.accounts.validate())]
    pub fn import_pool_permissionless(
        ctx: Context<ImportPoolPermissionless>,
        bump: u8,
    ) -> ProgramResult {
        ctx.accounts.validate_initial_parameters()?;
        import_pool::import_pool_unchecked(ctx.accounts, bump, true)
    }

    /// Imports a pool as the [PoolManager]'s operator.
    #[access_control(ctx.accounts.validate())]
    pub fn import_pool_as_operator(ctx: Context<ImportPoolAsOperator>, bump: u8) -> ProgramResult {
        import_pool::import_pool_unchecked(&mut ctx.accounts.import_pool, bump, false)
    }

    /// Ramp [SwapInfo]'s amplification coefficient to some target amplification coefficient.
    #[access_control(ctx.accounts.validate())]
    pub fn ramp_a(ctx: Context<SwapContext>, target_amp: u64, stop_ramp_ts: i64) -> ProgramResult {
        let seeds: &[&[&[u8]]] = gen_pool_signer_seeds!(ctx.accounts.pool);
        let cpi_ctx = cpi_helpers::pool_admin_cpi_context(
            &ctx.accounts.pool,
            ctx.accounts.swap.to_account_info(),
            ctx.accounts.swap_program.to_account_info(),
        )
        .with_signer(seeds);
        stable_swap_anchor::ramp_a(cpi_ctx, target_amp, stop_ramp_ts)
    }

    /// Stop ramping amplification coefficent.
    #[access_control(ctx.accounts.validate())]
    pub fn stop_ramp_a(ctx: Context<SwapContext>) -> ProgramResult {
        let seeds: &[&[&[u8]]] = gen_pool_signer_seeds!(ctx.accounts.pool);
        let cpi_ctx = cpi_helpers::pool_admin_cpi_context(
            &ctx.accounts.pool,
            ctx.accounts.swap.to_account_info(),
            ctx.accounts.swap_program.to_account_info(),
        )
        .with_signer(seeds);
        stable_swap_anchor::stop_ramp_a(cpi_ctx)
    }

    /// Pause the swap.
    #[access_control(ctx.accounts.validate())]
    pub fn pause_swap(ctx: Context<SwapContext>) -> ProgramResult {
        let seeds: &[&[&[u8]]] = gen_pool_signer_seeds!(ctx.accounts.pool);
        let cpi_ctx = cpi_helpers::pool_admin_cpi_context(
            &ctx.accounts.pool,
            ctx.accounts.swap.to_account_info(),
            ctx.accounts.swap_program.to_account_info(),
        )
        .with_signer(seeds);
        stable_swap_anchor::pause(cpi_ctx)
    }

    /// Unpause the swap.
    #[access_control(ctx.accounts.validate())]
    pub fn unpause_swap(ctx: Context<SwapContext>) -> ProgramResult {
        let seeds: &[&[&[u8]]] = gen_pool_signer_seeds!(ctx.accounts.pool);
        let cpi_ctx = cpi_helpers::pool_admin_cpi_context(
            &ctx.accounts.pool,
            ctx.accounts.swap.to_account_info(),
            ctx.accounts.swap_program.to_account_info(),
        )
        .with_signer(seeds);
        stable_swap_anchor::unpause(cpi_ctx)
    }

    /// Commits a new admin to [SwapInfo].
    #[access_control(ctx.accounts.validate())]
    pub fn commit_new_admin(ctx: Context<CommitNewAdmin>) -> ProgramResult {
        let seeds: &[&[&[u8]]] = gen_pool_signer_seeds!(ctx.accounts.pool);

        let admin_user_context = cpi_helpers::create_pool_admin_user_context(
            &ctx.accounts.pool,
            ctx.accounts.swap.to_account_info(),
        );
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.swap_program.to_account_info(),
            stable_swap_anchor::CommitNewAdmin {
                admin_ctx: admin_user_context,
                new_admin: ctx.accounts.new_admin.to_account_info(),
            },
            seeds,
        );
        stable_swap_anchor::commit_new_admin(cpi_ctx)
    }

    /// Apply the new admin on [SwapInfo].
    #[access_control(ctx.accounts.validate())]
    pub fn apply_new_admin(ctx: Context<SwapContext>) -> ProgramResult {
        let seeds: &[&[&[u8]]] = gen_pool_signer_seeds!(ctx.accounts.pool);
        let cpi_ctx = cpi_helpers::pool_admin_cpi_context(
            &ctx.accounts.pool,
            ctx.accounts.swap.to_account_info(),
            ctx.accounts.swap_program.to_account_info(),
        )
        .with_signer(seeds);
        stable_swap_anchor::apply_new_admin(cpi_ctx)
    }

    /// Set new fees on the [SwapInfo].
    #[access_control(ctx.accounts.validate())]
    pub fn set_new_fees(ctx: Context<SwapContext>, new_fees: SwapFees) -> ProgramResult {
        let seeds: &[&[&[u8]]] = gen_pool_signer_seeds!(ctx.accounts.pool);
        let cpi_ctx = cpi_helpers::pool_admin_cpi_context(
            &ctx.accounts.pool,
            ctx.accounts.swap.to_account_info(),
            ctx.accounts.swap_program.to_account_info(),
        )
        .with_signer(seeds);
        stable_swap_anchor::set_new_fees(cpi_ctx, new_fees.into())
    }

    /// Sends fees on a [Pool] fee account to an ATA controlled by the beneficiary.
    /// Anyone may call this.
    #[access_control(ctx.accounts.validate())]
    pub fn send_fees_to_beneficiary(ctx: Context<SendFeesToBeneficiary>) -> ProgramResult {
        let seeds: &[&[&[u8]]] = gen_pool_signer_seeds!(ctx.accounts.pool);
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.fee_account.to_account_info(),
                    to: ctx.accounts.beneficiary_account.to_account_info(),
                    authority: ctx.accounts.pool.to_account_info(),
                },
            )
            .with_signer(seeds),
            ctx.accounts.fee_account.amount,
        )
    }

    /// Sets the [PoolManager::operator].
    #[access_control(ctx.accounts.validate())]
    pub fn set_operator(ctx: Context<SetOperator>) -> ProgramResult {
        let pool_manager = &mut ctx.accounts.pool_manager;
        pool_manager.operator = ctx.accounts.operator.key();

        Ok(())
    }

    /// Sets the [PoolManager::beneficiary].
    #[access_control(ctx.accounts.validate())]
    pub fn set_beneficiary(ctx: Context<SetBeneficiary>) -> ProgramResult {
        let pool_manager = &mut ctx.accounts.pool_manager;
        pool_manager.beneficiary = ctx.accounts.beneficiary.key();

        Ok(())
    }
}

/// Accounts for [pools::new_pool_manager].
#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct NewPoolManager<'info> {
    /// The [PoolManager].
    #[account(
        init,
        seeds = [
            b"SaberPoolManager".as_ref(),
            base.key().to_bytes().as_ref()
        ],
        bump = bump,
        payer = payer
    )]
    pub pool_manager: Account<'info, PoolManager>,

    /// Base key.
    pub base: Signer<'info>,

    /// Admin of the [PoolManager].
    pub admin: UncheckedAccount<'info>,

    /// Operator of the [PoolManager].
    pub operator: UncheckedAccount<'info>,

    /// Beneficiary of the [PoolManager].
    pub beneficiary: UncheckedAccount<'info>,

    /// Payer of the [PoolManager] initialization.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// [System] program.
    pub system_program: Program<'info, System>,
}

/// Accounts for [pools::import_pool_permissionless].
#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct ImportPoolPermissionless<'info> {
    /// The [PoolManager].
    #[account(mut)]
    pub pool_manager: Box<Account<'info, PoolManager>>,

    /// [SwapInfo] to import.
    pub swap: Box<Account<'info, SwapInfo>>,

    /// [Pool].
    #[account(
        init,
        seeds = [
            b"SaberPool".as_ref(),
            pool_manager.key().to_bytes().as_ref(),
            swap.sorted_mints().0.to_bytes().as_ref(),
            swap.sorted_mints().1.to_bytes().as_ref()
        ],
        bump = bump,
        payer = payer
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// Fee account for token A.
    pub token_a_fees: Box<Account<'info, TokenAccount>>,

    /// Fee account for token B.
    pub token_b_fees: Box<Account<'info, TokenAccount>>,

    /// Mint of the LP token.
    pub lp_mint: Box<Account<'info, Mint>>,

    /// Payer of the [Pool] initialization.
    #[account(mut)]
    pub payer: Signer<'info>,
    /// [System] program.
    pub system_program: Program<'info, System>,
}

/// Accounts for [pools::import_pool_as_operator].
#[derive(Accounts)]
pub struct ImportPoolAsOperator<'info> {
    /// The admin or operator of the [PoolManager].
    pub admin_or_operator: Signer<'info>,
    /// Import pool accounts.
    pub import_pool: ImportPoolPermissionless<'info>,
}

#[derive(Accounts)]
pub struct SwapContext<'info> {
    pub pool_manager: Account<'info, PoolManager>,
    #[account(mut)]
    pub swap: AccountInfo<'info>,
    pub pool: Account<'info, Pool>,
    pub swap_program: Program<'info, StableSwap>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct CommitNewAdmin<'info> {
    pub pool_manager: Account<'info, PoolManager>,
    #[account(mut)]
    pub swap: UncheckedAccount<'info>,
    pub pool: Account<'info, Pool>,
    pub admin: Signer<'info>,
    pub new_admin: UncheckedAccount<'info>,
    pub swap_program: Program<'info, StableSwap>,
}

#[derive(Accounts)]
pub struct SendFeesToBeneficiary<'info> {
    pub pool_manager: Account<'info, PoolManager>,
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub fee_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub beneficiary_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SetOperator<'info> {
    #[account(mut)]
    pub pool_manager: Account<'info, PoolManager>,
    pub admin: Signer<'info>,
    pub operator: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct SetBeneficiary<'info> {
    #[account(mut)]
    pub pool_manager: Account<'info, PoolManager>,
    pub admin: Signer<'info>,
    pub beneficiary: UncheckedAccount<'info>,
}

/// Error codes.
#[error]
pub enum ErrorCode {
    #[msg("Must be admin to perform this action.")]
    NotAdmin,
    #[msg("Must be admin or operator to perform this action.")]
    NotAdminOrOperator,
    #[msg("Initial amp factor out of range.")]
    InitialAmpOutOfRange,
    #[msg("Swap fees do not match the configured initial parameters.")]
    InitialFeesMismatch,
    #[msg("Swap's token mints must be sorted.")]
    SwapTokensNotSorted,
    #[msg("Swap's token mints cannot be the same.")]
    SwapTokensCannotBeEqual,
    #[msg("Specified fee account invalid.")]
    InvalidFeeAccount,
}
