use anchor_lang::prelude::*;

/// Manages all [Pool]s.
#[account]
#[derive(Copy, Default, Debug)]
pub struct PoolManager {
    /// The base [Pubkey] of the [PoolManager].
    pub base: Pubkey,
    /// Bump seed
    pub bump: u8,
    /// Total number of [Pool]s being managed.
    pub num_pools: u64,

    /// The admin of the [PoolManager].
    pub admin: Pubkey,
    /// The next admin of the [PoolManager].
    pub pending_admin: Pubkey,

    /// Initial fees used when creating new pools.
    pub initial_fees: SwapFees,

    /// Minimum amp factor for permissionless pools.
    pub min_permissionless_amp_factor: u64,
    /// Minimum amp factor for permissionless pools.
    pub max_permissionless_amp_factor: u64,

    /// Account which has the authority to set the amplification coefficient of pools.
    pub operator: Pubkey,

    /// Account which all fees may be withdrawn to.
    pub beneficiary: Pubkey,
}

/// The admin of a [stable_swap_anchor::SwapInfo].
#[account]
#[derive(Copy, Default, Debug)]
pub struct Pool {
    /// The [PoolManager].
    pub manager: Pubkey,
    /// [anchor_spl::token::Mint] of token A.
    pub mint_a: Pubkey,
    /// [anchor_spl::token::Mint] of token B.
    pub mint_b: Pubkey,
    /// Bump seed
    pub bump: u8,

    /// The [stable_swap_anchor::SwapInfo].
    pub swap: Pubkey,
    /// Creation index, 1-indexed.
    pub index: u64,

    /// Token account holding fees of token A.
    pub token_a_fees: Pubkey,
    /// Token account holding fees of token B.
    pub token_b_fees: Pubkey,

    /// LP token mint.
    pub lp_mint: Pubkey,
    /// Decimal for the mints.
    pub token_decimals: u8,
    /// Flag indicating if the pool was imported with [crate::pools::import_pool_permissionless].
    pub permissionless_import: bool,
}

// Redefinitions.
//
// The following types are redefined so that they can be parsed into the IDL,
// since Anchor doesn't yet support idl parsing across multiple crates.

/// Pool fees.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, Debug, PartialEq, Eq)]
pub struct SwapFees {
    /// Admin trade fee numerator
    pub admin_trade_fee_numerator: u64,
    /// Admin trade fee denominator
    pub admin_trade_fee_denominator: u64,
    /// Admin withdraw fee numerator
    pub admin_withdraw_fee_numerator: u64,
    /// Admin withdraw fee denominator
    pub admin_withdraw_fee_denominator: u64,
    /// Trade fee numerator
    pub trade_fee_numerator: u64,
    /// Trade fee denominator
    pub trade_fee_denominator: u64,
    /// Withdraw fee numerator
    pub withdraw_fee_numerator: u64,
    /// Withdraw fee denominator
    pub withdraw_fee_denominator: u64,
}

impl From<SwapFees> for stable_swap_client::fees::Fees {
    fn from(e: SwapFees) -> Self {
        let SwapFees {
            admin_trade_fee_numerator,
            admin_trade_fee_denominator,
            admin_withdraw_fee_numerator,
            admin_withdraw_fee_denominator,
            trade_fee_numerator,
            trade_fee_denominator,
            withdraw_fee_numerator,
            withdraw_fee_denominator,
        } = e;
        Self {
            admin_trade_fee_numerator,
            admin_trade_fee_denominator,
            admin_withdraw_fee_numerator,
            admin_withdraw_fee_denominator,
            trade_fee_numerator,
            trade_fee_denominator,
            withdraw_fee_numerator,
            withdraw_fee_denominator,
        }
    }
}
