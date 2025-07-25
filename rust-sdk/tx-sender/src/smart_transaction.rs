//
// Copyright (c) Cryptic Dot
//
// Licensed under FusionAMM SDK Source-Available License v1.0
// See the LICENSE file in the project root for license information.
//

use crate::jito::{get_jito_api_url_by_region, poll_jito_bundle_statuses, send_jito_bundle, JITO_TIP_ACCOUNTS, MIN_JITO_TIP_LAMPORTS};
use crate::priority_fee::get_priority_fee_estimate;
use crate::PriorityFeeLevel;
use log::warn;
use rand::Rng;
use reqwest::Client;
use solana_client::client_error::{ClientError, ClientErrorKind};
use solana_client::nonblocking::rpc_client::RpcClient;
use solana_client::rpc_config::{RpcSendTransactionConfig, RpcSimulateTransactionConfig};
use solana_client::rpc_response::{Response, RpcSimulateTransactionResult};
use solana_commitment_config::{CommitmentConfig, CommitmentLevel};
use solana_compute_budget_interface::ComputeBudgetInstruction;
use solana_instruction::Instruction;
use solana_keypair::Keypair;
use solana_message::{v0, VersionedMessage};
use solana_program::address_lookup_table::AddressLookupTableAccount;
use solana_program::hash::Hash;
use solana_pubkey::Pubkey;
use solana_signature::Signature;
use solana_signer::SignerError;
use solana_system_interface::instruction::transfer;
use solana_transaction::versioned::VersionedTransaction;
use solana_transaction_error::TransactionError;
use solana_transaction_status::TransactionConfirmationStatus;
use std::str::FromStr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::time::sleep;

const MAX_COMPUTE_UNIT_LIMIT: u32 = 1_400_000;
const DEFAULT_TRANSACTION_TIMEOUT_SECONDS: u64 = 60;
const DEFAULT_COMPUTE_UNIT_MARGIN_MULTIPLIER: f64 = 1.15;

#[derive(Clone)]
pub struct SmartTxConfig {
    pub priority_fee: Option<SmartTxPriorityFeeConfig>,
    pub jito: Option<SmartTxJitoConfig>,
    /// This value is only used if estimation fails.
    pub default_compute_unit_limit: u32,
    pub compute_unit_margin_multiplier: f64,
    pub ingore_simulation_error: bool,
    pub sig_verify_on_simulation: bool,
    /// The default timeout is 60 seconds.
    pub transaction_timeout: Option<Duration>,
}

impl Default for SmartTxConfig {
    fn default() -> Self {
        Self {
            priority_fee: None,
            jito: None,
            default_compute_unit_limit: MAX_COMPUTE_UNIT_LIMIT,
            compute_unit_margin_multiplier: DEFAULT_COMPUTE_UNIT_MARGIN_MULTIPLIER,
            ingore_simulation_error: false,
            sig_verify_on_simulation: true,
            transaction_timeout: None,
        }
    }
}

#[derive(Clone)]
pub struct SmartTxPriorityFeeConfig {
    pub additional_addresses: Vec<Pubkey>,
    pub fee_level: PriorityFeeLevel,
    pub fee_min: u64,
    pub fee_max: u64,
}

#[derive(Clone)]
pub struct SmartTxJitoConfig {
    pub uuid: String,
    pub tips: u64,
    pub region: Option<String>,
}

#[derive(Clone)]
pub struct SmartTxResult {
    /// The transaction signature.
    pub signature: String,
    /// Used priority fee (micro lamports per compute unit).
    pub priority_fee: u64,
    /// Jito bundle id if the transaction has been sent via Jito.
    pub jito_bundle_id: Option<String>,
}

#[allow(clippy::enum_variant_names)]
#[allow(clippy::large_enum_variant)]
#[derive(thiserror::Error, Debug)]
pub enum SmartTransactionError {
    #[error(transparent)]
    CompileError(#[from] solana_program::message::CompileError),
    #[error(transparent)]
    SigningError(#[from] SignerError),
    #[error(transparent)]
    SimulationError(#[from] TransactionError),
    #[error(transparent)]
    RpcClientError(#[from] ClientError),
    #[error("JitoClientError: {0}")]
    JitoClientError(String),
}

pub async fn send_smart_transaction(
    client: &RpcClient,
    signers: Vec<Arc<Keypair>>,
    payer: &Pubkey,
    instructions: Vec<Instruction>,
    lookup_tables: Vec<AddressLookupTableAccount>,
    tx_config: SmartTxConfig,
) -> Result<SmartTxResult, SmartTransactionError> {
    let transaction_timeout = tx_config
        .transaction_timeout
        .unwrap_or_else(|| Duration::from_secs(DEFAULT_TRANSACTION_TIMEOUT_SECONDS));

    let mut priority_fee = 0;

    if let Some(fee_config) = tx_config.priority_fee {
        // Priority fee is not required for jito bundles.
        if tx_config.jito.is_none() && fee_config.fee_level != PriorityFeeLevel::None {
            let mut accounts_and_programs: Vec<Pubkey> = instructions.iter().flat_map(|ix| ix.accounts.iter()).map(|a| a.pubkey).collect();
            accounts_and_programs.extend(fee_config.additional_addresses);
            priority_fee = u64::max(
                u64::min(get_priority_fee_estimate(client, accounts_and_programs, fee_config.fee_level).await?, fee_config.fee_max),
                fee_config.fee_min,
            )
        }
    }

    let signers_copy: Vec<Keypair> = signers.iter().map(|keypair| keypair.insecure_clone()).collect();

    let mut all_instructions = Vec::<Instruction>::new();
    if priority_fee > 0 {
        all_instructions.push(ComputeBudgetInstruction::set_compute_unit_price(priority_fee));
    }
    all_instructions.extend(instructions);

    // Add a tip instruction to the end of the instructions list if jito tips are provided.
    if let Some(jito_config) = tx_config.jito.clone() {
        let rnd = rand::rng().random_range(0..JITO_TIP_ACCOUNTS.len());
        let tip_amount = jito_config.tips.max(MIN_JITO_TIP_LAMPORTS);
        let random_tip_account = Pubkey::from_str(JITO_TIP_ACCOUNTS[rnd]).unwrap();
        let tip_instruction = transfer(payer, &random_tip_account, tip_amount);
        all_instructions.push(tip_instruction);
    }

    // Simulate transaction and estimate CU usage. A simulation may fail, so do it a few times.
    let mut cu_limit = 0;
    for _ in 0..5 {
        match simulate_transaction(client, &all_instructions, payer, &signers_copy, lookup_tables.clone(), tx_config.sig_verify_on_simulation).await {
            Ok(response) => {
                if let Some(err) = response.value.err {
                    match err.clone() {
                        TransactionError::BlockhashNotFound => continue,
                        err => {
                            if !tx_config.ingore_simulation_error {
                                return Err(err.into());
                            } else {
                                warn!(target: "log", "Simulation failed with error: {:?}", err);
                                break;
                            }
                        }
                    }
                }

                let cu_consumed = response.value.units_consumed.unwrap_or(0);

                // Add margin to the consumed compute units during the simulation.
                cu_limit = u32::min(MAX_COMPUTE_UNIT_LIMIT, (cu_consumed as f64 * tx_config.compute_unit_margin_multiplier.clamp(1.0, 10.0)) as u32);
                break;
            }
            Err(_) => {
                //warn!(target: "log", "Simulation failed with error: {:?}", err);
                continue;
            }
        };
    }

    if cu_limit == 0 {
        cu_limit = tx_config.default_compute_unit_limit;
        if cu_limit > 0 {
            warn!(target: "log", "Simulation failed; setting the CU limit to the default value of {}", cu_limit);
        } else {
            warn!(target: "log", "Simulation failed; setting the CU limit to the default value");
        }
    };

    if cu_limit > 0 {
        all_instructions.insert(0, ComputeBudgetInstruction::set_compute_unit_limit(cu_limit));
    }

    let recent_blockhash = client.get_latest_blockhash().await?;

    //
    // Recreate the transaction with the updated CU limit.
    //
    let versioned_message = VersionedMessage::V0(v0::Message::try_compile(payer, &all_instructions, &lookup_tables, recent_blockhash)?);
    let transaction = VersionedTransaction::try_new(versioned_message, &signers_copy)?;

    if let Some(jito_config) = tx_config.jito {
        let serialized_transaction = bincode::serialize(&transaction).expect("Failed to serialize transaction");
        let transaction_base58 = bs58::encode(&serialized_transaction).into_string();

        let user_provided_region = jito_config.region.unwrap_or("Default".to_string());
        let jito_api_base_url = get_jito_api_url_by_region(&user_provided_region);
        let jito_api_url = if jito_config.uuid.is_empty() {
            format!("{}/api/v1/bundles", jito_api_base_url)
        } else {
            format!("{}/api/v1/bundles?uuid={}", jito_api_base_url, jito_config.uuid)
        };

        // Send the transaction as Jito bundle.
        let jito_client = Client::new();
        let jito_bundle_id = send_jito_bundle(jito_client.clone(), vec![transaction_base58], &jito_api_url)
            .await
            .map_err(|e| SmartTransactionError::JitoClientError(e.to_string()))?;

        // Wait for the confirmation.
        let signature = poll_jito_bundle_statuses(jito_client.clone(), jito_bundle_id.clone(), &jito_api_url, transaction_timeout)
            .await
            .map_err(|e| SmartTransactionError::JitoClientError(e.to_string()))?;

        Ok(SmartTxResult {
            signature,
            priority_fee,
            jito_bundle_id: Some(jito_bundle_id),
        })
    } else {
        let send_config = RpcSendTransactionConfig {
            skip_preflight: true,
            preflight_commitment: Some(CommitmentLevel::Confirmed),
            max_retries: Some(0),
            ..RpcSendTransactionConfig::default()
        };

        // Send the transaction.
        let signature = client.send_transaction_with_config(&transaction, send_config).await?;

        // Wait for the confirmation.
        poll_transaction_confirmation(client, signature, transaction_timeout).await?;

        Ok(SmartTxResult {
            signature: signature.to_string(),
            priority_fee,
            jito_bundle_id: None,
        })
    }
}

#[allow(clippy::result_large_err)]
async fn simulate_transaction(
    client: &RpcClient,
    instructions: &[Instruction],
    payer: &Pubkey,
    signers: &[Keypair],
    lookup_tables: Vec<AddressLookupTableAccount>,
    sig_verify: bool,
) -> Result<Response<RpcSimulateTransactionResult>, SmartTransactionError> {
    // Set the compute budget limit
    let mut test_instructions = vec![ComputeBudgetInstruction::set_compute_unit_limit(MAX_COMPUTE_UNIT_LIMIT)];
    test_instructions.extend(instructions.to_vec());

    // Fetch the latest blockhash
    let recent_blockhash = if sig_verify {
        client.get_latest_blockhash().await?
    } else {
        Hash::default()
    };

    let versioned_message = VersionedMessage::V0(v0::Message::try_compile(payer, &test_instructions, &lookup_tables, recent_blockhash)?);
    let transaction = VersionedTransaction::try_new(versioned_message, signers)?;

    let simulate_config = RpcSimulateTransactionConfig {
        sig_verify,
        replace_recent_blockhash: !sig_verify,
        commitment: Some(CommitmentConfig::confirmed()),
        encoding: None,
        accounts: None,
        min_context_slot: None,
        inner_instructions: false,
    };

    let result = client.simulate_transaction_with_config(&transaction, simulate_config).await?;
    Ok(result)
}

/// Poll a transaction to check whether it has been confirmed
///
/// * `txt-sig` - The transaction signature to check
///
/// # Returns
/// The confirmed transaction signature or an error if the confirmation times out
async fn poll_transaction_confirmation(client: &RpcClient, tx_sig: Signature, timeout: Duration) -> Result<Signature, ClientError> {
    // 2 seconds retry interval
    let interval = Duration::from_secs(2);
    let start = Instant::now();

    while start.elapsed() < timeout {
        let status = client.get_signature_statuses(&[tx_sig]).await?;

        match status.value[0].clone() {
            Some(status) => {
                if status.err.is_none()
                    && (status.confirmation_status == Some(TransactionConfirmationStatus::Confirmed)
                        || status.confirmation_status == Some(TransactionConfirmationStatus::Finalized))
                {
                    return Ok(tx_sig);
                }
                if status.err.is_some() {
                    warn!(target: "log", "Transaction {} failed with error: {}", tx_sig, status.err.clone().unwrap());
                    return Err(ClientError {
                        request: None,
                        kind: status.err.unwrap().into(),
                    });
                }
            }
            None => {
                sleep(interval).await;
            }
        }
    }

    Err(ClientError {
        request: None,
        kind: ClientErrorKind::Custom(format!("Unable to confirm transaction {} in {} seconds", tx_sig, timeout.as_secs())),
    })
}
