import { ALICE_ADDRESS, ALICE_MNEMONIC, BLOCKCHAIN_PARAMETERS, BOB_MNEMONIC, POOL_ADDRESS, POOL_MNEMONIC, utxo } from './constants';
import { signTxInput } from './sign';
import { describe, it, expect, beforeAll } from 'vitest';
import { AvlTree$, ProverBuilder$, ReducedInputData, ReducedTransaction } from 'sigmastate-js/main';
import bip39 from 'bip39';
import { headers, jsonHeaders, sigmaJsHeader } from 'fakeContext';
import { OutputBuilder, SAFE_MIN_BOX_VALUE, TransactionBuilder } from '@fleet-sdk/core';
import { EIP12UnsignedTransaction, UnsignedTransaction } from '@fleet-sdk/common';
type SignedTransaction = import("./node_modules/sigmastate-js/node_modules/@fleet-sdk/common/dist/esm/types/transactions").SignedTransaction;

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
		const signedBobInput = await signTxInput(POOL_MNEMONIC, unsignedTx, 0);
		expect(signedBobInput).toBeDefined();
	});

	it('sigmastate.js can reduceTransactionInput', async () => {
		const buffer = await bip39.mnemonicToSeed(POOL_MNEMONIC);
		const mnemonicPhrase = buffer.toString('hex');

		const prover = ProverBuilder$.create(BLOCKCHAIN_PARAMETERS, network).withMnemonic(
			mnemonicPhrase,
			'',
		).build();

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
