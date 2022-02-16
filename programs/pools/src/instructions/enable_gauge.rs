use anchor_lang::prelude::*;
use gauge::{Gauge, Gaugemeister};
use vipers::prelude::*;

use crate::{gen_pool_manager_signer_seeds, Pool, PoolManager};

#[derive(Accounts)]
pub struct EnableGauge<'info> {
    pub pool_manager: Account<'info, PoolManager>,
    pub gaugemeister: Account<'info, Gaugemeister>,
    #[account(mut)]
    pub gauge: Account<'info, Gauge>,
    pub quarry: Account<'info, quarry_mine::Quarry>,

    /// The [Pool] to import.
    pub pool: Account<'info, Pool>,

    /// [gauge::ID] program.
    pub gauge_program: Program<'info, gauge::program::Gauge>,
}

pub fn handler(ctx: Context<EnableGauge>) -> ProgramResult {
    let seeds: &[&[&[u8]]] = gen_pool_manager_signer_seeds!(ctx.accounts.pool_manager);

    gauge::cpi::gauge_enable(
        CpiContext::new(
            ctx.accounts.gauge_program.to_account_info(),
            gauge::cpi::accounts::GaugeEnable {
                gaugemeister: ctx.accounts.gaugemeister.to_account_info(),
                gauge: ctx.accounts.gauge.to_account_info(),
                foreman: ctx.accounts.pool_manager.to_account_info(),
            },
        )
        .with_signer(seeds),
    )?;

    Ok(())
}

impl<'info> Validate<'info> for EnableGauge<'info> {
    fn validate(&self) -> ProgramResult {
        assert_keys_eq!(self.quarry, self.gauge.quarry);
        assert_keys_eq!(self.pool.lp_mint, self.quarry.token_mint_key);
        invariant!(!self.pool.permissionless_import);
        Ok(())
    }
}
