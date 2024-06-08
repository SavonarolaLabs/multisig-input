import {
	ALICE_ADDRESS,
	ALICE_MNEMONIC,
	BOB_ADDRESS,
	BOB_MNEMONIC,
	POOL_ADDRESS,
	POOL_MNEMONIC,
	utxo,
} from './constants';
import { a, bMultiInput, cMultiInput, signTxInput, signTxMulti } from './sign';
import { describe, it, expect, beforeAll } from 'vitest';
import { ProverBuilder$, ReducedInputData } from 'sigmastate-js/main';
import bip39 from 'bip39';
import { headers, sigmaJsHeader } from 'fakeContext';
import { OutputBuilder, SAFE_MIN_BOX_VALUE, TransactionBuilder } from '@fleet-sdk/core';
import { EIP12UnsignedTransaction, UnsignedTransaction } from '@fleet-sdk/common';

const network = 0;
const height = 1_260_252;

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

	it('ergo-lib-wasm-nodejs can sign Input', async () => {
		const signedBobInput = await signTxInput(POOL_MNEMONIC, unsignedTx, 0);
		expect(signedBobInput).toBeDefined();
	});

	it('ergo-lib-wasm-nodejs can MultiSignTx with 1 input Tx', async () => {
		const signedTx = await signTxMulti(unsignedTx, BOB_MNEMONIC, BOB_ADDRESS);

		// console.log('--------------------TEST 2-----------------');
		// console.log('final Tx:');
		// console.dir(signedTx, { depth: null });

		expect(signedTx).toBeDefined();
	});

	it('ergo-lib-wasm-nodejs can MultiSignInput with 1 input Tx', async () => {
		const { privateCommitsPool, publicCommitsPool } = await a(unsignedTx); // use sign ALL

		const extractedHints = await bMultiInput(
			unsignedTx,
			BOB_MNEMONIC,
			BOB_ADDRESS,
			publicCommitsPool,
		);

		const signedTx = await cMultiInput(unsignedTx, privateCommitsPool, extractedHints);

		// console.log('--------------------TEST 3-----------------');
		// console.log('final Tx:');
		// console.dir(signedTx.to_js_eip12(), { depth: null });

		expect(extractedHints).toBeDefined();
	});

	it.skip('sigma-state.js can sign', async () => {
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
		const address = prover.getP2PKAddress();
		expect(address).toBe('9hLjz8tcDD6iLALjcTjyHxqZu8qQQ1VkrPnWhroGbhUr8yNgiaz');

		const stateCtx = {
			sigmaLastHeaders: headers.map(h => JSON.parse(h)).map(sigmaJsHeader),
			previousStateDigest: JSON.parse(headers[0]).stateRoot,
			sigmaPreHeader: sigmaJsHeader(JSON.parse(headers[0])),
		};

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
