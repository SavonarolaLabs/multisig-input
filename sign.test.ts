import { ALICE_ADDRESS, ALICE_MNEMONIC, POOL_ADDRESS, POOL_MNEMONIC, utxo } from './constants';
import { signTxInput } from './sign';
import { describe, it, expect, beforeAll } from 'vitest';
import { AvlTree$, ProverBuilder$, ReducedInputData } from 'sigmastate-js/main';
import bip39 from 'bip39';
import { headers, jsonHeaders, sigmaJsHeader } from 'fakeContext';
import { OutputBuilder, SAFE_MIN_BOX_VALUE, TransactionBuilder } from '@fleet-sdk/core';
import { EIP12UnsignedTransaction, UnsignedTransaction } from '@fleet-sdk/common';

const network = 0;
const height = 1_282_255;

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

	it('sigma-state.js can sign', async () => {
		const BLOCKCHAIN_PARAMETERS = {
			storageFeeFactor: 1000,
			minValuePerByte: 1,
			maxBlockSize: 1000000,
			tokenAccessCost: 100,
			inputCost: 10,
			dataInputCost: 10,
			outputCost: 10,
			maxBlockCost: 1000000,
			softForkStartingHeight: 100,
			softForkVotesCollected: 50,
			blockVersion: 1,
		};
		const buffer = await bip39.mnemonicToSeed(ALICE_MNEMONIC);
		const mnemonicPhrase = buffer.toString('hex');

		const builder = ProverBuilder$.create(BLOCKCHAIN_PARAMETERS, network).withMnemonic(
			mnemonicPhrase,
			'',
		);

		const prover = builder.build();


		const xHeaders = jsonHeaders.map(sigmaJsHeader).reverse()

		const stateCtx = {
			sigmaLastHeaders: xHeaders,
			previousStateDigest: xHeaders[0].stateRoot.digest,
			sigmaPreHeader: xHeaders[0],
		};
		//let parsed = parse(stateCtx.sigmaLastHeaders[0].stateRoot);
		//expect(parsed).toBe(1)

		const data: ReducedInputData = prover.reduceTransactionInput(
			stateCtx,
			unsignedTx,
			unsignedTx.inputs,
			unsignedTx.dataInputs,
			[],
			0,
		);
		expect(data).toBeDefined();
	});
});
