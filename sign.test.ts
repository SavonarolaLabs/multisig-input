import {
	ALICE_ADDRESS,
	ALICE_MNEMONIC,
	BLOCKCHAIN_PARAMETERS,
	BOB_ADDRESS,
	BOB_MNEMONIC,
	POOL_ADDRESS,
	POOL_MNEMONIC,
	utxo,
} from './constants';
import { signTx, signTxInput, signTxMulti, verifyInput } from './sign';
import { describe, it, expect, beforeAll } from 'vitest';
import { AvlTree$, ProverBuilder$, ReducedInputData, ReducedTransaction } from 'sigmastate-js/main';
import bip39 from 'bip39';
import { headers, jsonHeaders, sigmaJsHeader } from 'fakeContext';
import {
	ErgoAddress,
	OutputBuilder,
	SAFE_MIN_BOX_VALUE,
	SGroupElement,
	SSigmaProp,
	TransactionBuilder,
} from '@fleet-sdk/core';
import { EIP12UnsignedTransaction, first, Network, UnsignedTransaction } from '@fleet-sdk/common';
import { compile } from '@fleet-sdk/compiler';
type SignedTransaction =
	import('./node_modules/sigmastate-js/node_modules/@fleet-sdk/common/dist/esm/types/transactions').SignedTransaction;

const network = 0;
const height = 1282261;

let unsignedTx: EIP12UnsignedTransaction;

describe('UnsignedTransaction', () => {
	beforeAll(() => {
		const output = new OutputBuilder(
			2n * SAFE_MIN_BOX_VALUE + SAFE_MIN_BOX_VALUE,
			ALICE_ADDRESS,
		);

		unsignedTx = new TransactionBuilder(height)
			.from(utxo)
			.to(output)
			.sendChangeTo(POOL_ADDRESS)
			.payFee(SAFE_MIN_BOX_VALUE)
			.build()
			.toEIP12Object();
	});

	it('ergo-lib-wasm-nodejs can sign', async () => {
		const signedBobInput = await signTxInput(unsignedTx, POOL_MNEMONIC, 0);
		expect(signedBobInput).toBeDefined();
	});

	it('sigmastate.js can reduceTransactionInput', async () => {
		const buffer = await bip39.mnemonicToSeed(POOL_MNEMONIC);
		const mnemonicPhrase = buffer.toString('hex');

		const prover = ProverBuilder$.create(BLOCKCHAIN_PARAMETERS, network)
			.withMnemonic(mnemonicPhrase, '')
			.build();

		const xHeaders = jsonHeaders.map(sigmaJsHeader);

		const stateCtx = {
			sigmaLastHeaders: xHeaders.slice(1),
			previousStateDigest: xHeaders[1].stateRoot.digest,
			sigmaPreHeader: xHeaders[0],
		};

		const reducedInput: ReducedInputData = prover.reduceTransactionInput(
			stateCtx,
			unsignedTx,
			unsignedTx.inputs,
			unsignedTx.dataInputs,
			[],
			0,
		);
		expect(reducedInput).toBeDefined();

		const reducedTx: ReducedTransaction = prover.reduce(
			stateCtx,
			unsignedTx,
			unsignedTx.inputs,
			unsignedTx.dataInputs,
			[],
			0,
		);
		expect(reducedTx).toBeDefined();

		const hints = prover.generateCommitments(reducedTx);
		expect(hints).toBeDefined();
		//console.dir(hints, {depth:null})

		//const signedTx: SignedTransaction = prover.signReduced(reducedTx, hints);
		//expect(signedTx).toBeDefined();
	});
});

describe('ergo-lib-wasm-nodejs', () => {
	beforeAll(() => {
		const output = new OutputBuilder(
			2n * SAFE_MIN_BOX_VALUE + SAFE_MIN_BOX_VALUE,
			ALICE_ADDRESS,
		);

		unsignedTx = new TransactionBuilder(height)
			.from(utxo)
			.to(output)
			.sendChangeTo(POOL_ADDRESS)
			.payFee(SAFE_MIN_BOX_VALUE)
			.build()
			.toEIP12Object();
	});

	it.only('can sign simple multisig', async () => {
		//Deposit contract

		const CONTRACT_MULTISIG = `{
			UserPk && PoolPk
		}`;
		const contract_multisig = compileContract(CONTRACT_MULTISIG);

		const output = new OutputBuilder(
			2n * SAFE_MIN_BOX_VALUE + SAFE_MIN_BOX_VALUE,
			contract_multisig,
		);

		unsignedTx = new TransactionBuilder(height)
			.from(utxo)
			.to(output)
			.sendChangeTo(POOL_ADDRESS)
			.payFee(SAFE_MIN_BOX_VALUE)
			.build()
			.toEIP12Object();

		const signedTx = await signTx(unsignedTx, POOL_MNEMONIC);
		expect(signedTx).toBeDefined();

		const depositBox = signedTx.outputs[0];
		//Withdraw

		const withdrawUTx = new TransactionBuilder(height)
			.from(depositBox)
			.sendChangeTo(POOL_ADDRESS)
			.payFee(SAFE_MIN_BOX_VALUE)
			.build()
			.toEIP12Object();

		const withdrawTx = await signTxMulti(withdrawUTx, BOB_MNEMONIC, BOB_ADDRESS);
		expect(withdrawTx).toBeDefined();

		const verifyInput0 = verifyInput(withdrawTx, withdrawUTx, 0);
		expect(verifyInput0).toBe(true);
	});

	it('can sign multisig + user ', async () => {
		const signedBobInput = await signTxInput(unsignedTx, POOL_MNEMONIC, 0);
		expect(signedBobInput).toBeDefined();
	});
});

export function compileContract(contract: string) {
	const tree = compile(contract, {
		version: 0,
		includeSize: false,
		map: {
			PoolPk: SSigmaProp(
				SGroupElement(first(ErgoAddress.fromBase58(POOL_ADDRESS).getPublicKeys())),
			).toHex(),
			UserPk: SSigmaProp(
				SGroupElement(first(ErgoAddress.fromBase58(BOB_ADDRESS).getPublicKeys())),
			).toHex(),
		},
	});
	return tree.toAddress(Network.Mainnet).toString();
}
