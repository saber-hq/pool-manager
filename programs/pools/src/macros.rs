//! Macros.

/// Generates the signer seeds for a [crate::PoolManager].
#[macro_export]
macro_rules! gen_pool_manager_signer_seeds {
    ($pool_manager:expr) => {
        &[&[
            b"SaberPoolManager".as_ref(),
            &$pool_manager.base.to_bytes(),
            &[$pool_manager.bump],
        ]]
    };
}

/// Generates the signer seeds for a [crate::Pool].
#[macro_export]
macro_rules! gen_pool_signer_seeds {
    ($pool:expr) => {
        &[&[
            b"SaberPool".as_ref(),
            &$pool.manager.to_bytes(),
            &$pool.sorted_mints().0.to_bytes(),
            &$pool.sorted_mints().1.to_bytes(),
            &[$pool.bump],
        ]]
    };
}
