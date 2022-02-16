use anchor_lang::prelude::*;
use quarry_operator::Operator;
use vipers::prelude::*;

use crate::{gen_pool_manager_signer_seeds, Pool, PoolManager};

#[derive(Accounts)]
pub struct CreateQuarry<'info> {
    pub pool_manager: Account<'info, PoolManager>,
    #[account(mut)]
    pub operator: Account<'info, Operator>,
    pub rewarder: Account<'info, quarry_mine::Rewarder>,

    /// Quarry to be created.
    #[account(zero)]
    pub quarry: UncheckedAccount<'info>,

    /// Saber LP.
    pub token_mint: Box<Account<'info, anchor_spl::token::Mint>>,

    /// The [Pool] to import.
    pub pool: Account<'info, Pool>,

    /// Payer of [quarry_mine::Quarry] creation.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// [System] program.
    pub system_program: Program<'info, System>,

    /// [quarry_mine::ID] program.
    pub quarry_mine_program: Program<'info, quarry_mine::program::QuarryMine>,

    /// [quarry_operator::ID] program.
    pub quarry_operator_program: Program<'info, quarry_operator::program::QuarryOperator>,
}

pub fn handler(ctx: Context<CreateQuarry>, bump: u8) -> ProgramResult {
    let seeds: &[&[&[u8]]] = gen_pool_manager_signer_seeds!(ctx.accounts.pool_manager);

    quarry_operator::cpi::delegate_create_quarry(
        CpiContext::new(
            ctx.accounts.quarry_operator_program.to_account_info(),
            quarry_operator::cpi::accounts::DelegateCreateQuarry {
                with_delegate: quarry_operator::cpi::accounts::WithDelegate {
                    operator: ctx.accounts.operator.to_account_info(),
                    delegate: ctx.accounts.pool_manager.to_account_info(),
                    rewarder: ctx.accounts.rewarder.to_account_info(),
                    quarry_mine_program: ctx.accounts.quarry_mine_program.to_account_info(),
                },
                quarry: ctx.accounts.quarry.to_account_info(),
                token_mint: ctx.accounts.token_mint.to_account_info(),
                payer: ctx.accounts.payer.to_account_info(),
                unused_clock: ctx.accounts.system_program.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
            },
        )
        .with_signer(seeds),
        bump,
    )?;

    Ok(())
}

impl<'info> Validate<'info> for CreateQuarry<'info> {
    fn validate(&self) -> ProgramResult {
        assert_keys_eq!(self.token_mint, self.pool.lp_mint);
        invariant!(!self.pool.permissionless_import);

        Ok(())
    }
}
