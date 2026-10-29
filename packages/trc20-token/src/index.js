/**
 * @tronless/trc20-token
 * Read-only TRC-20 helpers built on `wallet/triggerconstantcontract`. No private key, no signing.
 */
import { TronClient, NETWORKS } from '@tronless/tron-client';
import { toBase58, isValidAddress } from '@tronless/tron-address';
import { decodeParameters, encodeParameters } from '@tronless/trc20-decoder';
import { formatUnits, TOKENS } from '@tronless/tron-units';

/** Resolve "USDT" / "usdc" / a contract address into a contract address for the client's network. */
export function resolveContract(token, client) {
  if (isValidAddress(token)) return toBase58(token);
  const symbol = String(token).toUpperCase();
  if (symbol === 'USDT') {
    const preset = client?.preset || NETWORKS.mainnet;
    return preset.usdt;
  }
  const known = TOKENS[symbol];
  if (known?.address && (!client || client.network === 'mainnet')) return known.address;
  throw new Error(`Unknown token "${token}" for ${client?.network || 'mainnet'} — pass the contract address`);
}

function getClient(options) {
  return options.client || new TronClient({ network: options.network || 'mainnet' });
}

/**
 * Call a constant (view/pure) function and decode its outputs.
 * @param {{contract: string, method: string, types?: string[], values?: unknown[], outputs?: string[], from?: string, client?: TronClient, network?: string}} call
 */
export async function callConstant(call) {
  const client = getClient(call);
  const contract = resolveContract(call.contract, client);
  const types = call.types || [];
  const values = call.values || [];
  const res = await client.triggerConstantContract({
    ownerAddress: call.from || contract,
    contractAddress: contract,
    functionSelector: call.method,
    parameter: types.length ? encodeParameters(types, values) : '',
  });
  const result = res?.result;
  if (result && result.result !== true) {
    const msg = res.result?.message ? hexToUtf8(res.result.message) : JSON.stringify(res.result);
    throw new Error(`Constant call ${call.method} on ${contract} failed: ${msg}`);
  }
  const hex = (res?.constant_result || [])[0] || '';
  if (!hex) throw new Error(`Constant call ${call.method} on ${contract} returned no data (is it a contract on ${client.network}?)`);
  const outputs = call.outputs || [];
  return {
    contract,
    method: call.method,
    raw: hex,
    values: outputs.length ? decodeParameters(outputs, hex) : [],
    energyUsed: res?.energy_used ?? null,
  };
}

function hexToUtf8(hex) {
  try {
    return new TextDecoder().decode(Uint8Array.from(String(hex).match(/../g) || [], (h) => parseInt(h, 16)));
  } catch {
    return String(hex);
  }
}

async function tryString(contract, method, options) {
  try {
    const r = await callConstant({ ...options, contract, method, outputs: ['string'] });
    return r.values[0];
  } catch {
    // Some old tokens return bytes32 for name()/symbol()
    try {
      const r = await callConstant({ ...options, contract, method, outputs: ['bytes32'] });
      return hexToUtf8(String(r.values[0]).replace(/^0x/, '')).replace(/\0+$/, '');
    } catch {
      return null;
    }
  }
}

/**
 * Token metadata: name, symbol, decimals, totalSupply.
 * @param {string} token contract address or symbol (USDT, USDC…)
 */
export async function getTokenInfo(token, options = {}) {
  const client = getClient(options);
  const contract = resolveContract(token, client);
  // Sequential on purpose: anonymous TronGrid allows ~3 requests/s and suspends for 5 s when exceeded.
  const decimalsRes = await callConstant({ client, contract, method: 'decimals()', outputs: ['uint8'] });
  const name = await tryString(contract, 'name()', { client });
  const symbol = await tryString(contract, 'symbol()', { client });
  const supplyRes = await callConstant({ client, contract, method: 'totalSupply()', outputs: ['uint256'] }).catch(() => null);
  const decimals = Number(decimalsRes.values[0]);
  const totalSupplyRaw = supplyRes ? supplyRes.values[0] : null;
  return {
    address: contract,
    network: client.network,
    name,
    symbol,
    decimals,
    totalSupplyRaw,
    totalSupply: totalSupplyRaw != null ? formatUnits(totalSupplyRaw, decimals) : null,
    explorer: client.explorerAddress(contract),
  };
}

/**
 * balanceOf(holder) with decimals-aware formatting.
 * @param {string} token contract address or symbol
 * @param {string} holder address in any form
 * @param {{client?: TronClient, network?: string, decimals?: number}} [options] pass decimals to skip the extra call
 */
export async function getBalance(token, holder, options = {}) {
  const client = getClient(options);
  const contract = resolveContract(token, client);
  if (!isValidAddress(holder)) throw new Error(`Invalid holder address: ${holder}`);
  const [balRes, decimals] = await Promise.all([
    callConstant({ client, contract, method: 'balanceOf(address)', types: ['address'], values: [holder], outputs: ['uint256'] }),
    options.decimals != null ? options.decimals : callConstant({ client, contract, method: 'decimals()', outputs: ['uint8'] }).then((r) => Number(r.values[0])),
  ]);
  const raw = balRes.values[0];
  return {
    contract,
    holder: toBase58(holder),
    network: client.network,
    raw,
    decimals,
    balance: formatUnits(raw, decimals),
  };
}

/** USDT TRC-20 balance shortcut (mainnet/nile/shasta presets). */
export function getUsdtBalance(holder, options = {}) {
  return getBalance('USDT', holder, { decimals: 6, ...options });
}

/** allowance(owner, spender). */
export async function getAllowance(token, owner, spender, options = {}) {
  const client = getClient(options);
  const contract = resolveContract(token, client);
  const [res, decimals] = await Promise.all([
    callConstant({ client, contract, method: 'allowance(address,address)', types: ['address', 'address'], values: [owner, spender], outputs: ['uint256'] }),
    options.decimals != null ? options.decimals : callConstant({ client, contract, method: 'decimals()', outputs: ['uint8'] }).then((r) => Number(r.values[0])),
  ]);
  const raw = res.values[0];
  return { contract, owner: toBase58(owner), spender: toBase58(spender), raw, decimals, allowance: formatUnits(raw, decimals) };
}

/** Balances of one holder across several tokens. Sequential to stay under TronGrid's anonymous rate limit. */
export async function getBalances(tokens, holder, options = {}) {
  const out = [];
  for (const t of tokens) {
    try {
      out.push(await getBalance(t, holder, options));
    } catch (err) {
      out.push({ contract: String(t), holder, error: err.message });
    }
  }
  return out;
}

export default { resolveContract, callConstant, getTokenInfo, getBalance, getUsdtBalance, getAllowance, getBalances };
