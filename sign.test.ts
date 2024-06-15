import { BOB_ADDRESS, BOB_MNEMONIC, POOL_ADDRESS, POOL_MNEMONIC, utxo } from './constants';
import {
	signTxMultiStep1,
	arrayToProposition,
	signInputMultiStep2,
	signInputMultiStep3,
	getProof,
	signTx,
	signTxMulti,
	validateTx,
	verifyInput,
	compileContract,
} from './sign';
import { describe, it, expect, beforeAll } from 'vitest';
import { fakeContext } from 'fakeContext';
import {
	ErgoAddress,
	OutputBuilder,
	SAFE_MIN_BOX_VALUE,
	SGroupElement,
	SSigmaProp,
	TransactionBuilder,
} from '@fleet-sdk/core';
import { EIP12UnsignedTransaction, first } from '@fleet-sdk/common';
import {
	ErgoBoxes,
	extract_hints,
	Input,
	Transaction,
	UnsignedTransaction,
} from 'ergo-lib-wasm-nodejs';

const height = 1209955;

describe('ergo-lib-wasm-nodejs', () => {
	let withdrawUTx: EIP12UnsignedTransaction;

	beforeAll(async () => {
		const CONTRACT_MULTISIG = `{
			BobPk && PoolPk
		}`;

		const map = {
			PoolPk: SSigmaProp(
				SGroupElement(first(ErgoAddress.fromBase58(POOL_ADDRESS).getPublicKeys())),
			).toHex(),
			BobPk: SSigmaProp(
				SGroupElement(first(ErgoAddress.fromBase58(BOB_ADDRESS).getPublicKeys())),
			).toHex(),
		};

		const contract_multisig = compileContract(CONTRACT_MULTISIG, map);

		const output = new OutputBuilder(
			2n * SAFE_MIN_BOX_VALUE + SAFE_MIN_BOX_VALUE,
			contract_multisig,
		);

		const unsignedTx = new TransactionBuilder(height)
			.from(utxo)
			.to(output)
			.sendChangeTo(POOL_ADDRESS)
			.payFee(SAFE_MIN_BOX_VALUE)
			.build()
			.toEIP12Object();

		const signedTx = await signTx(unsignedTx, POOL_MNEMONIC);
		expect(signedTx).toBeDefined();

		const depositBox = signedTx.outputs[0];

		withdrawUTx = new TransactionBuilder(height)
			.from(depositBox)
			.sendChangeTo(POOL_ADDRESS)
			.payFee(SAFE_MIN_BOX_VALUE)
			.build()
			.toEIP12Object();
	});

	it('can sign simple multisig', async () => {
		const withdrawTx = await signTxMulti(withdrawUTx, BOB_MNEMONIC, BOB_ADDRESS);
		expect(withdrawTx).toBeDefined();

		const verifyInput0 = verifyInput(withdrawTx, withdrawUTx, 0);
		expect(verifyInput0).toBe(true);

		expect(
			() => validateTx(withdrawTx, withdrawUTx),
			'withdraw tx validation',
		).not.toThrowError();
	});

	it('can sign simple multisig by SignInput  ', async () => {
		const { privateCommitsPool, publicCommitsPool } = await signTxMultiStep1(withdrawUTx);
		expect(publicCommitsPool).toBeDefined();

		const sInput0: Input = await signInputMultiStep2(
			withdrawUTx,
			BOB_MNEMONIC,
			BOB_ADDRESS,
			publicCommitsPool,
			0,
		);

		const unsigned_tx = UnsignedTransaction.from_json(JSON.stringify(withdrawUTx));
		const tx = Transaction.from_unsigned_tx(unsigned_tx, [getProof(sInput0)]);
		const hUser = ErgoAddress.fromBase58(BOB_ADDRESS).ergoTree.slice(6);

		let extractedHints = extract_hints(
			tx,
			fakeContext(),
			ErgoBoxes.from_boxes_json(withdrawUTx.inputs),
			ErgoBoxes.empty(),
			arrayToProposition([hUser]),
			arrayToProposition([]),
		).to_json();

		const signedInput = await signInputMultiStep3(
			withdrawUTx,
			privateCommitsPool,
			extractedHints,
			0,
		);
		const utx = UnsignedTransaction.from_json(JSON.stringify(withdrawUTx));
		const signedTx = Transaction.from_unsigned_tx(utx, [getProof(signedInput)]);

		const signedWithId = signedTx.to_js_eip12();
		signedWithId.id = signedTx.id().to_str();

		expect(
			() => validateTx(signedWithId, withdrawUTx),
			'withdraw tx validation',
		).not.toThrowError();
	});
});
