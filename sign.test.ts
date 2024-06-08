import { ALICE_ADDRESS, ALICE_MNEMONIC, POOL_ADDRESS, POOL_MNEMONIC, utxo } from './constants';
import { signTxInput } from './sign';
import { describe, it, expect, beforeAll } from 'vitest';
import { AvlTree$, ProverBuilder$, ReducedInputData } from 'sigmastate-js/main';
import bip39 from 'bip39';
import { headers, jsonHeaders, sigmaJsHeader } from 'fakeContext';
import { OutputBuilder, SAFE_MIN_BOX_VALUE, TransactionBuilder } from '@fleet-sdk/core';
import { EIP12UnsignedTransaction, UnsignedTransaction } from '@fleet-sdk/common';

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

	it('sigma-state.js can sign', async () => {
		//https://api.ergoplatform.com/api/v1/info
		const info = {
			lastBlockId: '5b9b19ac028c6956b4cdf8ec75227934b8134ff3635ed3aceac8a8bf20788dce',
			height: 1282261,
			maxBoxGix: 6197269,
			maxTxGix: 1167892,
			params: {
				height: 506880,
				storageFeeFactor: 1250000,
				minValuePerByte: 360,
				maxBlockSize: 1271009,
				maxBlockCost: 7030268,
				blockVersion: 2,
				tokenAccessCost: 100,
				inputCost: 2000,
				dataInputCost: 100,
				outputCost: 100,
			},
		};
		const BLOCKCHAIN_PARAMETERS = {
			storageFeeFactor: info.params.storageFeeFactor,
			minValuePerByte: info.params.minValuePerByte,
			maxBlockSize: info.params.maxBlockSize,
			tokenAccessCost: info.params.tokenAccessCost,
			inputCost: info.params.inputCost,
			dataInputCost: info.params.dataInputCost,
			outputCost: info.params.outputCost,
			maxBlockCost: info.params.maxBlockCost,
			softForkStartingHeight: 100,
			softForkVotesCollected: 50,
			blockVersion: info.params.blockVersion,
		};
		const buffer = await bip39.mnemonicToSeed(POOL_MNEMONIC);
		const mnemonicPhrase = buffer.toString('hex');

		const builder = ProverBuilder$.create(BLOCKCHAIN_PARAMETERS, network).withMnemonic(
			mnemonicPhrase,
			'',
		);

		const prover = builder.build();

		const xHeaders = jsonHeaders.map(sigmaJsHeader);

		const stateCtx = {
			sigmaLastHeaders: xHeaders.slice(1),
			previousStateDigest: xHeaders[1].stateRoot.digest,
			sigmaPreHeader: xHeaders[0],
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
