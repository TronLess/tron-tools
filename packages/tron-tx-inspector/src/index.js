/**
 * @tronless/tron-tx-inspector
 * One call → a human-readable receipt for any TRON transaction.
 */
import { TronClient } from '@tronless/tron-client';
import { decodeTransaction, decodeTransactionInfoLogs } from '@tronless/trc20-decoder';
import { fromSun, formatUnits, TOKENS } from '@tronless/tron-units';

const KNOWN_TOKENS = Object.fromEntries(Object.values(TOKENS).filter((t) => t.address).map((t) => [t.address, t]));

/** Contract types → short labels. */
export const CONTRACT_LABELS = Object.freeze({
  TransferContract: 'TRX transfer',
  TransferAssetContract: 'TRC-10 transfer',
  TriggerSmartContract: 'Smart contract call',
  CreateSmartContract: 'Contract deployment',
  FreezeBalanceV2Contract: 'Stake TRX (Stake 2.0)',
  UnfreezeBalanceV2Contract: 'Unstake TRX (Stake 2.0)',
  DelegateResourceContract: 'Delegate resource',
  UnDelegateResourceContract: 'Undelegate resource',
  WithdrawExpireUnfreezeContract: 'Withdraw unstaked TRX',
  WithdrawBalanceContract: 'Claim rewards',
  VoteWitnessContract: 'Vote for SR',
  AccountCreateContract: 'Create account',
  AccountPermissionUpdateContract: 'Update permissions',
  FreezeBalanceContract: 'Freeze (legacy)',
  UnfreezeBalanceContract: 'Unfreeze (legacy)',
});

function hexToUtf8(hex) {
  try {
    return new TextDecoder().decode(Uint8Array.from(String(hex).match(/../g) || [], (h) => parseInt(h, 16)));
  } catch {
    return null;
  }
}

/**
 * Pure normalizer: combine gettransactionbyid + gettransactioninfobyid.
 * @param {object} tx
 * @param {object} [info]
 * @param {{network?: string, explorer?: (txid:string)=>string|null}} [meta]
 */
export function buildReceipt(tx, info = {}, meta = {}) {
  const decoded = decodeTransaction(tx);
  const receipt = info.receipt || {};
  const confirmed = info.blockNumber != null;
  const contractRet = decoded.result;
  let status = 'PENDING';
  if (confirmed) {
    if (receipt.result && receipt.result !== 'SUCCESS') status = receipt.result;
    else if (contractRet && contractRet !== 'SUCCESS') status = contractRet;
    else status = 'SUCCESS';
  } else if (contractRet && contractRet !== 'SUCCESS') {
    status = contractRet;
  }

  const energyUsageTotal = Number(receipt.energy_usage_total || 0);
  const energyFromStake = Number(receipt.energy_usage || 0);
  const energyFromOrigin = Number(receipt.origin_energy_usage || 0);
  const energyBurnedSun = Number(receipt.energy_fee || 0);
  const energyBurnedUnits = energyUsageTotal - energyFromStake - energyFromOrigin;
  const netUsage = Number(receipt.net_usage || 0);
  const netFeeSun = Number(receipt.net_fee || 0);
  const totalFeeSun = Number(info.fee || 0);
  const otherSun = Math.max(0, totalFeeSun - energyBurnedSun - netFeeSun);
  const energyPriceSun = energyBurnedUnits > 0 ? energyBurnedSun / energyBurnedUnits : null;

  const events = decodeTransactionInfoLogs(info);
  const tokenTransfers = events
    .filter((e) => e.name === 'Transfer')
    .map((e) => {
      const known = KNOWN_TOKENS[e.contract];
      return {
        contract: e.contract,
        symbol: known?.symbol || null,
        decimals: known?.decimals ?? null,
        from: e.from,
        to: e.to,
        amountRaw: e.value,
        amount: known ? formatUnits(e.value, known.decimals) : null,
      };
    });

  const knownToken = decoded.contract ? KNOWN_TOKENS[decoded.contract] : null;
  let amount = null;
  if (decoded.type === 'TransferContract') amount = { asset: 'TRX', raw: String(decoded.amountSun), value: fromSun(decoded.amountSun || 0) };
  else if (decoded.type === 'TransferAssetContract') amount = { asset: decoded.asset, raw: String(decoded.amountRaw), value: null };
  else if (decoded.amountRaw != null) {
    amount = {
      asset: knownToken?.symbol || decoded.contract,
      raw: String(decoded.amountRaw),
      value: knownToken ? formatUnits(decoded.amountRaw, knownToken.decimals) : null,
    };
  }

  return {
    txid: decoded.txid,
    network: meta.network || null,
    status,
    confirmed,
    contractResult: contractRet,
    failureMessage: info.resMessage ? hexToUtf8(info.resMessage) : null,
    block: info.blockNumber ?? null,
    timestamp: info.blockTimeStamp ? new Date(info.blockTimeStamp).toISOString() : decoded.timestamp ? new Date(decoded.timestamp).toISOString() : null,
    type: decoded.type,
    typeLabel: CONTRACT_LABELS[decoded.type] || decoded.type,
    from: decoded.from,
    to: decoded.to || null,
    contract: decoded.contract || null,
    method: decoded.method || null,
    input: decoded.input || null,
    amount,
    memo: decoded.memo,
    feeLimitSun: decoded.feeLimit,
    fee: {
      totalSun: totalFeeSun,
      totalTrx: fromSun(totalFeeSun),
      energy: {
        total: energyUsageTotal,
        fromStake: energyFromStake,
        fromContractOwner: energyFromOrigin,
        burnedUnits: Math.max(0, energyBurnedUnits),
        burnedSun: energyBurnedSun,
        burnedTrx: fromSun(energyBurnedSun),
        priceSunPerUnit: energyPriceSun,
        penaltyUnits: Number(receipt.energy_penalty_total || 0),
      },
      bandwidth: {
        bytes: netUsage,
        burnedSun: netFeeSun,
        burnedTrx: fromSun(netFeeSun),
      },
      other: { sun: otherSun, trx: fromSun(otherSun), note: otherSun ? 'account activation, memo or multi-sig fee' : null },
    },
    events,
    tokenTransfers,
    explorer: meta.explorer ? meta.explorer(decoded.txid) : null,
    raw: { transaction: tx, info },
  };
}

/**
 * Fetch and inspect a transaction.
 * @param {string} txid 64-hex transaction id
 * @param {{client?: TronClient, network?: string}} [options]
 */
export async function inspectTransaction(txid, options = {}) {
  const id = String(txid).trim().replace(/^0x/, '');
  if (!/^[0-9a-fA-F]{64}$/.test(id)) throw new Error('Transaction id must be 64 hex characters');
  const client = options.client || new TronClient({ network: options.network || 'mainnet' });
  const [tx, info] = await Promise.all([client.getTransactionById(id), client.getTransactionInfoById(id)]);
  if (!tx || !tx.raw_data) {
    return { txid: id, network: client.network, status: 'NOT_FOUND', confirmed: false, explorer: client.explorerTx(id) };
  }
  return buildReceipt(tx, info || {}, { network: client.network, explorer: (t) => client.explorerTx(t) });
}

/** Terminal-friendly rendering of a receipt. */
export function formatReceipt(r) {
  if (r.status === 'NOT_FOUND') return `${r.txid}\n  NOT FOUND on ${r.network}`;
  const lines = [];
  lines.push(`${r.txid}`);
  lines.push(`Status:     ${r.status}${r.failureMessage ? ` — ${r.failureMessage}` : ''}${r.confirmed ? '' : ' (not yet in a block)'}`);
  lines.push(`Type:       ${r.typeLabel}${r.method ? ` → ${r.method}()` : ''}`);
  if (r.block) lines.push(`Block:      ${r.block} @ ${r.timestamp}`);
  lines.push(`From:       ${r.from}`);
  if (r.contract) lines.push(`Contract:   ${r.contract}`);
  if (r.to) lines.push(`To:         ${r.to}`);
  if (r.amount) lines.push(`Amount:     ${r.amount.value ?? r.amount.raw} ${r.amount.asset}${r.amount.value ? ` (raw ${r.amount.raw})` : ''}`);
  if (r.memo) lines.push(`Memo:       ${r.memo}`);
  lines.push(`Fee:        ${r.fee.totalTrx} TRX total`);
  lines.push(`  energy:   ${r.fee.energy.total} used — ${r.fee.energy.fromStake} from stake, ${r.fee.energy.fromContractOwner} from contract owner, ${r.fee.energy.burnedUnits} burned = ${r.fee.energy.burnedTrx} TRX${r.fee.energy.priceSunPerUnit ? ` @ ${r.fee.energy.priceSunPerUnit} SUN` : ''}`);
  lines.push(`  bandwidth:${r.fee.bandwidth.bytes} bytes — ${r.fee.bandwidth.burnedTrx} TRX burned`);
  if (r.fee.other.sun) lines.push(`  other:    ${r.fee.other.trx} TRX (${r.fee.other.note})`);
  for (const t of r.tokenTransfers) lines.push(`Transfer:   ${t.amount ?? t.amountRaw} ${t.symbol || t.contract}  ${t.from} → ${t.to}`);
  if (r.explorer) lines.push(`Explorer:   ${r.explorer}`);
  return lines.join('\n');
}

export default { CONTRACT_LABELS, buildReceipt, inspectTransaction, formatReceipt };
