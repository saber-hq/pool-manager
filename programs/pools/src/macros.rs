//! Macros.

/// Generates the signer seeds for a [crate::Pool].
#[macro_export]
macro_rules! gen_pool_signer_seeds {
    ($pool:expr) => {
        &[&[
            b"SaberPool".as_ref(),
            &$pool.manager.to_bytes(),
            &$pool.mint_a.to_bytes(),
            &$pool.mint_b.to_bytes(),
            &[$pool.bump],
        ]]
    };
}
