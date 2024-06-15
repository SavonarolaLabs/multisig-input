import { ALICE_ADDRESS, ALICE_MNEMONIC, BOB_ADDRESS, BOB_MNEMONIC, POOL_ADDRESS, POOL_MNEMONIC, utxo } from './constants';
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
	getProver,
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
	TransactionHintsBag,
	UnsignedTransaction,
} from 'ergo-lib-wasm-nodejs';

const height = 1209955;

describe('ergo-lib-wasm-nodejs', () => {
	let withdrawUTx: EIP12UnsignedTransaction;
	let mixedWithdrawUTx: EIP12UnsignedTransaction;

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

		

		const oTemp = new OutputBuilder(
			SAFE_MIN_BOX_VALUE+1n,
			ALICE_ADDRESS,
		)
		const tempTX = new TransactionBuilder(height)
			.from(utxo[0])
			.to(oTemp)
			.sendChangeTo(BOB_ADDRESS)
			.payFee(SAFE_MIN_BOX_VALUE)
			.build()
			.toEIP12Object();
		
		const signedTx2 = await signTx(tempTX, POOL_MNEMONIC);
		expect(signedTx).toBeDefined();

		mixedWithdrawUTx = new TransactionBuilder(height)
			.configureSelector((selector)=> selector.ensureInclusion([depositBox, signedTx2.outputs[0]].map(b=>b.boxId)))
			.from([depositBox, signedTx2.outputs[0]])
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

	it('can sign simple multisig by SignInput', async () => {
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

	it('can sign MIXED multisig by SignInput', async () => {

		expect(mixedWithdrawUTx.inputs.length).toBe(2)
		const { privateCommitsPool, publicCommitsPool } = await signTxMultiStep1(mixedWithdrawUTx);
		expect(publicCommitsPool).toBeDefined();

		const sInput0: Input = await signInputMultiStep2(
			mixedWithdrawUTx,
			BOB_MNEMONIC,
			BOB_ADDRESS,
			publicCommitsPool,
			0,
		);

		const unsigned_tx = UnsignedTransaction.from_json(JSON.stringify(mixedWithdrawUTx));
		const tx = Transaction.from_unsigned_tx(unsigned_tx, [getProof(sInput0),getProof(sInput0)]);
		const hUser = ErgoAddress.fromBase58(BOB_ADDRESS).ergoTree.slice(6);

		let extractedHints = extract_hints(
			tx,
			fakeContext(),
			ErgoBoxes.from_boxes_json(mixedWithdrawUTx.inputs),
			ErgoBoxes.empty(),
			arrayToProposition([hUser]),
			arrayToProposition([]),
		).to_json();
		const signedInput0 = await signInputMultiStep3(
			mixedWithdrawUTx,
			privateCommitsPool,
			extractedHints,
			0,
		);


		expect(mixedWithdrawUTx.inputs.at(1)?.ergoTree).toBe(ErgoAddress.fromBase58(ALICE_ADDRESS).ergoTree)
		const proverAlice = await getProver(ALICE_MNEMONIC);

		const aliceCommitments = proverAlice.generate_commitments(fakeContext(),
		UnsignedTransaction.from_json(JSON.stringify(mixedWithdrawUTx)),ErgoBoxes.from_boxes_json(mixedWithdrawUTx.inputs),
		ErgoBoxes.empty())
		const signedInput1 = proverAlice.sign_tx_input(
			1,
			fakeContext(),
			UnsignedTransaction.from_json(JSON.stringify(mixedWithdrawUTx)),
			ErgoBoxes.from_boxes_json(mixedWithdrawUTx.inputs),
			ErgoBoxes.empty(),
		);
		expect(1).toBe(2)

		const utx = UnsignedTransaction.from_json(JSON.stringify(mixedWithdrawUTx));
		const signedTx = Transaction.from_unsigned_tx(utx, [getProof(signedInput0), getProof(signedInput1)]);

		const signedWithId = signedTx.to_js_eip12();
		signedWithId.id = signedTx.id().to_str();

		expect(
			() => validateTx(signedWithId, mixedWithdrawUTx),
			'withdraw tx validation',
		).not.toThrowError();
	});
});
